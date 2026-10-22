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

/** Champs omis : inchangés sur une entrée existante, valeur par défaut sur une nouvelle. */
export interface EntryInput {
  status: LibraryStatus;
  chaptersRead?: number;
  volumesRead?: number;
  rating?: number | null;
  startedOn?: string | null;
  finishedOn?: string | null;
}

export interface LibraryService {
  /** `null` si l'œuvre n'est pas dans la liste ; `NOT_FOUND` si l'œuvre n'existe pas ou est archivée. */
  getEntry(userId: number, workId: number): Promise<LibraryEntry | null>;
  saveEntry(userId: number, workId: number, input: EntryInput): Promise<LibraryEntry>;
  /** Sans effet si l'œuvre n'est pas dans la liste. */
  removeEntry(userId: number, workId: number): Promise<void>;
  listEntries(userId: number, input: ListEntriesInput): Promise<LibraryPage>;
}

export interface ListEntriesInput {
  q?: string;
  status?: LibraryStatus[];
  lang?: string;
  sort: LibrarySort;
  page: number;
  pageSize: number;
}

export interface LibraryPage extends LibraryList {
  page: number;
  pageSize: number;
  /** Œuvres correspondant à la recherche et au filtre de statut. */
  total: number;
}

const NEW_ENTRY: Omit<LibraryEntry, 'status'> = {
  chaptersRead: 0,
  volumesRead: 0,
  rating: null,
  startedOn: null,
  finishedOn: null,
};

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/** Les champs fournis, `null` compris (il efface) ; un champ omis garde sa valeur actuelle. */
function providedFields(input: EntryInput): Partial<EntryInput> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/** Au changement de statut, propose la date de début (En cours) ou de fin (Terminé) si elle manque. */
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

function mergeEntry(current: LibraryEntry | null, input: EntryInput, today: string): LibraryEntry {
  const kept = current ?? { ...NEW_ENTRY, status: input.status };
  const merged: LibraryEntry = { ...kept, ...providedFields(input) };
  return withProposedDates(merged, current?.status, today);
}

/** Journal des progressions : une ligne par chose qui a changé (un retrait de note n'en produit pas). */
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

export function createLibraryService(
  repository: LibraryRepository,
  today: () => string = todayUtc,
): LibraryService {
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
