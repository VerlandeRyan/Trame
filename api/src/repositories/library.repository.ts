/** Queries behind a member's reading list: entries, reading journal and the filtered, counted list. */
import {
  sql,
  type Expression,
  type ExpressionBuilder,
  type Selectable,
  type SqlBool,
} from 'kysely';
import {
  type Database,
  type Db,
  type LibraryEntryRow,
  type ReadingEventRow,
} from '../db/database.js';
import { LIBRARY_STATUSES, type LibraryStatus } from '../domain/user-enums.js';
import type { WorkSummary } from './work.repository.js';
import { displayTitle, searchCondition, visibleWork, workSummaryColumns } from './work-sql.js';

/** How a reader follows one work. */
export interface LibraryEntry {
  status: LibraryStatus;
  chaptersRead: number;
  volumesRead: number;
  rating: number | null;
  startedOn: string | null;
  finishedOn: string | null;
}

/** `updated`: latest progress first; `title`: A→Z; `rating`: best rated first. */
export type LibrarySort = 'updated' | 'title' | 'rating';

/** Search, filter, sort and page of a reading-list query. */
export interface LibraryListCriteria {
  userId: number;
  /** Text already trimmed and at least 2 characters long. */
  q?: string;
  /** Several statuses: OR. */
  status?: LibraryStatus[];
  /** Application language: selects the displayed title (falls back to the original title). */
  lang?: string;
  sort: LibrarySort;
  limit: number;
  offset: number;
}

/** A work of the list, with its published totals (`null`: unknown or still being published). */
export interface ListedWork extends WorkSummary {
  chapters: number | null;
  volumes: number | null;
}

/** A work of the list together with the reader's entry. */
export interface ListedEntry {
  work: ListedWork;
  entry: LibraryEntry;
}

/** Chapters and volumes read across the whole list: two totals, never added together. */
export interface ReadingTotals {
  chaptersRead: number;
  volumesRead: number;
}

/** Number of works per reading status. */
export type StatusCounts = Record<LibraryStatus, number>;

/** A page of the list with the counts the screen needs. */
export interface LibraryList {
  /** The requested page, filtered by status. */
  items: ListedEntry[];
  /** Works per status, following the search `q` but not the status filter (tabs). */
  statusCounts: StatusCounts;
  /** Over the whole list, without search or filter. */
  totals: ReadingTotals;
}

/** A change to journal; counters carry the variation (negative when decreased). */
export type NewReadingEvent =
  | { kind: 'chapters'; chaptersAdded: number }
  | { kind: 'volumes'; volumesAdded: number }
  | { kind: 'status'; status: LibraryStatus }
  | { kind: 'rating'; rating: number };

/** Outcome of a decision: the entry to store and what to append to the journal. */
export interface EntryChange {
  entry: LibraryEntry;
  events: NewReadingEvent[];
}

/** Reading-list queries. */
export interface LibraryRepository {
  /** True if the work exists and is not archived. */
  isWorkAvailable(workId: number): Promise<boolean>;
  find(userId: number, workId: number): Promise<LibraryEntry | null>;
  /**
   * Stores the entry and its journal in one transaction. Writes of one reader are serialised:
   * `decide` receives the up-to-date current entry, which keeps the journal exact even when two
   * requests cross, including on a work not yet in the list.
   */
  save(
    userId: number,
    workId: number,
    decide: (current: LibraryEntry | null) => EntryChange,
  ): Promise<LibraryEntry>;
  remove(userId: number, workId: number): Promise<void>;
  /** Archived works are left out; their entry is kept. */
  list(criteria: LibraryListCriteria): Promise<LibraryList>;
}

/** The user's entries on unarchived works, narrowed by the search `q` when given. */
function ownEntries(userId: number, q: string | undefined) {
  return (eb: ExpressionBuilder<Database, 'library_entry' | 'work'>): Expression<SqlBool> => {
    const conditions: Expression<SqlBool>[] = [
      eb('library_entry.user_id', '=', userId),
      visibleWork(eb),
    ];
    if (q !== undefined) conditions.push(searchCondition(q, 'all'));
    return eb.and(conditions);
  };
}

/** Status counts all set to zero. */
export function zeroStatusCounts(): StatusCounts {
  return Object.fromEntries(LIBRARY_STATUSES.map((status) => [status, 0])) as StatusCounts;
}

/** Columns of an entry read on their own. */
const ENTRY_COLUMNS = [
  'status',
  'chapters_read',
  'volumes_read',
  'rating',
  'started_on',
  'finished_on',
] as const;

/** Converts a database row into an entry. */
function toEntry(
  row: Pick<Selectable<LibraryEntryRow>, (typeof ENTRY_COLUMNS)[number]>,
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

/** Entry columns read together with a work summary; `entryStatus` avoids a clash with `work.status`. */
export const LISTED_ENTRY_COLUMNS = [
  'library_entry.status as entryStatus',
  'library_entry.chapters_read as chaptersRead',
  'library_entry.volumes_read as volumesRead',
  'library_entry.rating',
  'library_entry.started_on as startedOn',
  'library_entry.finished_on as finishedOn',
] as const;

/** Shape of the entry columns once read with `LISTED_ENTRY_COLUMNS`. */
type ListedEntryColumns = Omit<LibraryEntry, 'status'> & { entryStatus: LibraryStatus };

/** Splits a row read with `LISTED_ENTRY_COLUMNS` into work and entry. */
export function toListedEntry<Row extends ListedEntryColumns>(
  row: Row,
): { work: Omit<Row, keyof ListedEntryColumns>; entry: LibraryEntry } {
  const { entryStatus, chaptersRead, volumesRead, rating, startedOn, finishedOn, ...work } = row;
  return {
    work,
    entry: { status: entryStatus, chaptersRead, volumesRead, rating, startedOn, finishedOn },
  };
}

/** Converts a journal event into its database row. */
function toEventRow(
  userId: number,
  workId: number,
  event: NewReadingEvent,
): Omit<ReadingEventRow, 'id' | 'occurred_at'> {
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

/** Creates the reading-list repository. */
export function createLibraryRepository(db: Db): LibraryRepository {
  return {
    async isWorkAvailable(workId) {
      const row = await db
        .selectFrom('work')
        .select('id')
        .where('id', '=', workId)
        .where(visibleWork)
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
        // `FOR UPDATE` locks nothing while the entry does not exist: serialise the reader instead.
        await sql`SELECT pg_advisory_xact_lock(${userId})`.execute(trx);
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
