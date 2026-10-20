import type { Selectable } from 'kysely';
import type { Db, LibraryEntryTable, LibraryStatus, ReadingEventTable } from '../db/database.js';

/** Le suivi d'une œuvre par son lecteur. */
export interface LibraryEntry {
  status: LibraryStatus;
  chaptersRead: number;
  volumesRead: number;
  rating: number | null;
  startedOn: string | null;
  finishedOn: string | null;
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
  };
}
