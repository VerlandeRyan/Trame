import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type Selectable,
  type SqlBool,
} from 'kysely';
import {
  LIBRARY_STATUSES,
  type Database,
  type Db,
  type LibraryEntryTable,
  type LibraryStatus,
  type ReadingEventTable,
} from '../db/database.js';
import {
  displayTitle,
  searchCondition,
  workSummaryColumns,
  type WorkSummary,
} from './work.repository.js';

/** Le suivi d'une œuvre par son lecteur. */
export interface LibraryEntry {
  status: LibraryStatus;
  chaptersRead: number;
  volumesRead: number;
  rating: number | null;
  startedOn: string | null;
  finishedOn: string | null;
}

/** `updated` : dernière progression d'abord ; `title` : A→Z ; `rating` : mieux notées d'abord. */
export type LibrarySort = 'updated' | 'title' | 'rating';

export interface LibraryListCriteria {
  userId: number;
  /** Texte déjà nettoyé (espaces) et d'au moins 2 caractères. */
  q?: string;
  /** Plusieurs statuts : OU. */
  status?: LibraryStatus[];
  /** Langue de l'application : sert à choisir le titre affiché (repli sur le titre original). */
  lang?: string;
  sort: LibrarySort;
  limit: number;
  offset: number;
}

/** Une œuvre de la liste, avec ses totaux publiés (`null` : inconnu ou en cours de publication). */
export interface ListedWork extends WorkSummary {
  chapters: number | null;
  volumes: number | null;
}

export interface ListedEntry {
  work: ListedWork;
  entry: LibraryEntry;
}

/** Chapitres et tomes lus sur toute la liste : deux totaux, jamais additionnés. */
export interface ReadingTotals {
  chaptersRead: number;
  volumesRead: number;
}

export type StatusCounts = Record<LibraryStatus, number>;

export interface LibraryList {
  /** La page demandée, filtrée par statut. */
  items: ListedEntry[];
  /** Œuvres par statut, selon la recherche `q` mais sans le filtre de statut (onglets). */
  statusCounts: StatusCounts;
  /** Sur toute la liste, sans recherche ni filtre. */
  totals: ReadingTotals;
}

/** Un changement à journaliser ; les compteurs portent la variation (négative si on retire). */
export type NewReadingEvent =
  | { kind: 'chapters'; chaptersAdded: number }
  | { kind: 'volumes'; volumesAdded: number }
  | { kind: 'status'; status: LibraryStatus }
  | { kind: 'rating'; rating: number };

/** Résultat d'une décision : l'entrée à enregistrer et ce qu'il faut ajouter au journal. */
export interface EntryChange {
  entry: LibraryEntry;
  events: NewReadingEvent[];
}

export interface LibraryRepository {
  /** Vrai si l'œuvre existe et n'est pas archivée. */
  isWorkAvailable(workId: number): Promise<boolean>;
  find(userId: number, workId: number): Promise<LibraryEntry | null>;
  /**
   * Enregistre l'entrée et son journal dans une même transaction. `decide` reçoit l'entrée
   * actuelle (verrouillée), ce qui garde le journal exact même si deux requêtes se croisent.
   */
  save(
    userId: number,
    workId: number,
    decide: (current: LibraryEntry | null) => EntryChange,
  ): Promise<LibraryEntry>;
  remove(userId: number, workId: number): Promise<void>;
  /** Les œuvres archivées n'y figurent pas ; leur entrée est conservée. */
  list(criteria: LibraryListCriteria): Promise<LibraryList>;
}

/** Entrées de l'utilisateur sur des œuvres non archivées, avec la recherche `q` si elle est donnée. */
function ownEntries(userId: number, q: string | undefined) {
  return (eb: ExpressionBuilder<Database, 'library_entry' | 'work'>): Expression<SqlBool> => {
    const conditions: Expression<SqlBool>[] = [
      eb('library_entry.user_id', '=', userId),
      eb('work.deleted_at', 'is', null),
    ];
    if (q !== undefined) conditions.push(searchCondition(q, 'all'));
    return eb.and(conditions);
  };
}

export function zeroStatusCounts(): StatusCounts {
  return Object.fromEntries(LIBRARY_STATUSES.map((status) => [status, 0])) as StatusCounts;
}

const ENTRY_COLUMNS = [
  'status',
  'chapters_read',
  'volumes_read',
  'rating',
  'started_on',
  'finished_on',
] as const;

function toEntry(
  row: Pick<Selectable<LibraryEntryTable>, (typeof ENTRY_COLUMNS)[number]>,
): LibraryEntry {
  return {
    status: row.status,
    chaptersRead: row.chapters_read,
    volumesRead: row.volumes_read,
    rating: row.rating,
    startedOn: row.started_on,
    finishedOn: row.finished_on,
  };
}

/** Colonnes de l'entrée lues avec un résumé d'œuvre ; `entryStatus` évite le conflit avec `work.status`. */
export const LISTED_ENTRY_COLUMNS = [
  'library_entry.status as entryStatus',
  'library_entry.chapters_read as chaptersRead',
  'library_entry.volumes_read as volumesRead',
  'library_entry.rating',
  'library_entry.started_on as startedOn',
  'library_entry.finished_on as finishedOn',
] as const;

type ListedEntryColumns = Omit<LibraryEntry, 'status'> & { entryStatus: LibraryStatus };

/** Sépare une ligne lue avec `LISTED_ENTRY_COLUMNS` en œuvre et entrée. */
export function toListedEntry<Row extends ListedEntryColumns>(
  row: Row,
): { work: Omit<Row, keyof ListedEntryColumns>; entry: LibraryEntry } {
  const { entryStatus, chaptersRead, volumesRead, rating, startedOn, finishedOn, ...work } = row;
  return {
    work,
    entry: { status: entryStatus, chaptersRead, volumesRead, rating, startedOn, finishedOn },
  };
}

function toEventRow(
  userId: number,
  workId: number,
  event: NewReadingEvent,
): Omit<ReadingEventTable, 'id' | 'occurred_at'> {
  const row = {
    user_id: userId,
    work_id: workId,
    chapters_added: null,
    volumes_added: null,
    new_status: null,
    new_rating: null,
  };
  switch (event.kind) {
    case 'chapters':
      return { ...row, kind: 'chapters', chapters_added: event.chaptersAdded };
    case 'volumes':
      return { ...row, kind: 'volumes', volumes_added: event.volumesAdded };
    case 'status':
      return { ...row, kind: 'status', new_status: event.status };
    case 'rating':
      return { ...row, kind: 'rating', new_rating: event.rating };
  }
}

export function createLibraryRepository(db: Db): LibraryRepository {
  return {
    async isWorkAvailable(workId) {
      const row = await db
        .selectFrom('work')
        .select('id')
        .where('id', '=', workId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();
      return row !== undefined;
    },

    async find(userId, workId) {
      const row = await db
        .selectFrom('library_entry')
        .select(ENTRY_COLUMNS)
        .where('user_id', '=', userId)
        .where('work_id', '=', workId)
        .executeTakeFirst();
      return row ? toEntry(row) : null;
    },

    async save(userId, workId, decide) {
      return db.transaction().execute(async (trx) => {
        const currentRow = await trx
          .selectFrom('library_entry')
          .select(ENTRY_COLUMNS)
          .where('user_id', '=', userId)
          .where('work_id', '=', workId)
          .forUpdate()
          .executeTakeFirst();
        const { entry, events } = decide(currentRow ? toEntry(currentRow) : null);

        const values = {
          status: entry.status,
          chapters_read: entry.chaptersRead,
          volumes_read: entry.volumesRead,
          rating: entry.rating,
          started_on: entry.startedOn,
          finished_on: entry.finishedOn,
        };
        await trx
          .insertInto('library_entry')
          .values({ user_id: userId, work_id: workId, ...values })
          .onConflict((conflict) =>
            conflict
              .columns(['user_id', 'work_id'])
              .doUpdateSet({ ...values, updated_at: new Date() }),
          )
          .execute();
        if (events.length > 0) {
          await trx
            .insertInto('reading_event')
            .values(events.map((event) => toEventRow(userId, workId, event)))
            .execute();
        }
        return entry;
      });
    },

    async remove(userId, workId) {
      await db
        .deleteFrom('library_entry')
        .where('user_id', '=', userId)
        .where('work_id', '=', workId)
        .execute();
    },

    async list({ userId, q, status, lang, sort, limit, offset }) {
      const shownTitle = displayTitle('work', lang);
      let itemsQuery = db
        .selectFrom('library_entry')
        .innerJoin('work', 'work.id', 'library_entry.work_id')
        .select([
          ...workSummaryColumns(shownTitle),
          'work.chapters',
          'work.volumes',
          ...LISTED_ENTRY_COLUMNS,
        ])
        .where(ownEntries(userId, q));
      if (status !== undefined) itemsQuery = itemsQuery.where('library_entry.status', 'in', status);
      if (sort === 'updated') itemsQuery = itemsQuery.orderBy('library_entry.updated_at', 'desc');
      if (sort === 'rating') {
        itemsQuery = itemsQuery.orderBy('library_entry.rating', (order) =>
          order.desc().nullsLast(),
        );
      }

      const [rows, countRows, totals] = await Promise.all([
        itemsQuery.orderBy(shownTitle).orderBy('work.id').limit(limit).offset(offset).execute(),
        db
          .selectFrom('library_entry')
          .innerJoin('work', 'work.id', 'library_entry.work_id')
          .select(['library_entry.status', (eb) => eb.fn.countAll<number>().as('count')])
          .where(ownEntries(userId, q))
          .groupBy('library_entry.status')
          .execute(),
        db
          .selectFrom('library_entry')
          .innerJoin('work', 'work.id', 'library_entry.work_id')
          .select([
            sql<number>`COALESCE(SUM(library_entry.chapters_read), 0)::bigint`.as('chaptersRead'),
            sql<number>`COALESCE(SUM(library_entry.volumes_read), 0)::bigint`.as('volumesRead'),
          ])
          .where(ownEntries(userId, undefined))
          .executeTakeFirstOrThrow(),
      ]);

      const statusCounts = zeroStatusCounts();
      for (const { status: counted, count } of countRows) statusCounts[counted] = count;
      return { items: rows.map(toListedEntry), statusCounts, totals };
    },
  };
}
