/** Business rules of the reading list: merging edits, proposed dates and the reading journal. */
import type { LibraryStatus } from '../db/database.js';
import { AppError } from '../errors.js';
import type {
  EntryChange,
  LibraryEntry,
  LibraryList,
  LibraryRepository,
  LibrarySort,
  NewReadingEvent,
} from '../repositories/library.repository.js';

/** Omitted fields: unchanged on an existing entry, default value on a new one. */
export interface EntryInput {
  status: LibraryStatus;
  chaptersRead?: number;
  volumesRead?: number;
  rating?: number | null;
  startedOn?: string | null;
  finishedOn?: string | null;
}

/** Reading-list operations. */
export interface LibraryService {
  /** `null` if the work is not in the list; `NOT_FOUND` if the work does not exist or is archived. */
  getEntry(userId: number, workId: number): Promise<LibraryEntry | null>;
  saveEntry(userId: number, workId: number, input: EntryInput): Promise<LibraryEntry>;
  /** No effect if the work is not in the list. */
  removeEntry(userId: number, workId: number): Promise<void>;
  listEntries(userId: number, input: ListEntriesInput): Promise<LibraryPage>;
}

/** Search, filter, sort and page of a reading-list read. */
export interface ListEntriesInput {
  q?: string;
  status?: LibraryStatus[];
  lang?: string;
  sort: LibrarySort;
  page: number;
  pageSize: number;
}

/** A page of the list with its counts. */
export interface LibraryPage extends LibraryList {
  page: number;
  pageSize: number;
  /** Works matching the search and the status filter. */
  total: number;
}

/** Defaults of a new entry, apart from its status. */
const NEW_ENTRY: Omit<LibraryEntry, 'status'> = {
  chaptersRead: 0,
  volumesRead: 0,
  rating: null,
  startedOn: null,
  finishedOn: null,
};

/** Today's date in UTC as `YYYY-MM-DD`. */
const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/** The provided fields, `null` included (it clears); an omitted field keeps its current value. */
function providedFields(input: EntryInput): Partial<EntryInput> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/** On a status change, proposes the start date (reading) or end date (completed) if missing. */
function withProposedDates(
  entry: LibraryEntry,
  previousStatus: LibraryStatus | undefined,
  today: string,
): LibraryEntry {
  if (entry.status === previousStatus) return entry;
  return {
    ...entry,
    startedOn: entry.status === 'reading' ? (entry.startedOn ?? today) : entry.startedOn,
    finishedOn: entry.status === 'completed' ? (entry.finishedOn ?? today) : entry.finishedOn,
  };
}

/** The entry that results from applying the input to the current one (or to a new one). */
function mergeEntry(current: LibraryEntry | null, input: EntryInput, today: string): LibraryEntry {
  const kept = current ?? { ...NEW_ENTRY, status: input.status };
  const merged: LibraryEntry = { ...kept, ...providedFields(input) };
  return withProposedDates(merged, current?.status, today);
}

/** Progress journal: one line per thing that changed (removing a rating produces none). */
function journalEvents(current: LibraryEntry | null, next: LibraryEntry): NewReadingEvent[] {
  const events: NewReadingEvent[] = [];
  if (next.status !== current?.status) events.push({ kind: 'status', status: next.status });
  const chaptersAdded = next.chaptersRead - (current?.chaptersRead ?? 0);
  if (chaptersAdded !== 0) events.push({ kind: 'chapters', chaptersAdded });
  const volumesAdded = next.volumesRead - (current?.volumesRead ?? 0);
  if (volumesAdded !== 0) events.push({ kind: 'volumes', volumesAdded });
  if (next.rating !== null && next.rating !== current?.rating) {
    events.push({ kind: 'rating', rating: next.rating });
  }
  return events;
}

/** Creates the reading-list service; `today` can be replaced in tests. */
export function createLibraryService(
  repository: LibraryRepository,
  today: () => string = todayUtc,
): LibraryService {
  /** Throws `NOT_FOUND` unless the work exists and is not archived. */
  async function assertWorkAvailable(workId: number): Promise<void> {
    if (!(await repository.isWorkAvailable(workId))) throw new AppError('NOT_FOUND');
  }

  return {
    async getEntry(userId, workId) {
      await assertWorkAvailable(workId);
      return repository.find(userId, workId);
    },

    async saveEntry(userId, workId, input) {
      await assertWorkAvailable(workId);
      const day = today();
      return repository.save(userId, workId, (current): EntryChange => {
        const entry = mergeEntry(current, input, day);
        return { entry, events: journalEvents(current, entry) };
      });
    },

    async removeEntry(userId, workId) {
      await assertWorkAvailable(workId);
      await repository.remove(userId, workId);
    },

    async listEntries(userId, { q, status, lang, sort, page, pageSize }) {
      const list = await repository.list({
        userId,
        q: q?.replace(/\s+/g, ' ').trim() || undefined,
        status,
        lang,
        sort,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      const counted = status ?? (Object.keys(list.statusCounts) as LibraryStatus[]);
      const total = counted.reduce((sum, each) => sum + list.statusCounts[each], 0);
      return { ...list, page, pageSize, total };
    },
  };
}
