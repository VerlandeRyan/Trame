/** A reader's tracking of one work: loading, saving and removing the entry. */
import type { ApiError } from '~/utils/api-error'
import {
  DEFAULT_LIBRARY_STATUS,
  libraryErrorKey,
  type LibraryEntry,
  type LibraryEntryChanges,
} from '~/utils/library'

/**
 * The reader's tracking of one work: read, add or update, and remove.
 * Reading can happen during server rendering (the visitor's cookie is forwarded): the entry and
 * the "loaded" flag go through `useState`, so the page arrives in the right state without flicker.
 * A change shows at once; requests go out one after another (chained "+1" never cross) and only
 * the last response, the server's, replaces the entry.
 */
export function useLibraryEntry(workId: number) {
  const api = useApi()
  const entry = useState<LibraryEntry | null>(`library-entry-${workId}`, () => null)
  const isLoaded = useState(`library-loaded-${workId}`, () => false)
  const path = `/works/${workId}/entry`

  /** Reads the entry from the API. */
  async function fetchEntry() {
    entry.value = (await api.request<{ entry: LibraryEntry | null }>(path)).entry
  }

  // After a failure the screen may have drifted from the server: read the entry again.
  const { run, isBusy, errorKey } = useOptimisticWrite({ resync: fetchEntry })

  /** Loads the entry and flags the state as loaded, even without an entry. */
  async function load() {
    let hasFailed = false
    try {
      await fetchEntry()
    } catch (cause) {
      hasFailed = true
      errorKey.value = libraryErrorKey((cause as ApiError).code)
    }
    // A failure during server rendering leaves it "not loaded": the browser will retry.
    if (!(import.meta.server && hasFailed)) isLoaded.value = true
  }

  /** Adds the work (status plan to read) or applies `changes` to the existing entry. */
  function save(changes: LibraryEntryChanges) {
    return run({
      apply: () => {
        if (entry.value) entry.value = { ...entry.value, ...changes }
      },
      send: async () => {
        const body = { status: entry.value?.status ?? DEFAULT_LIBRARY_STATUS, ...changes }
        return (await api.request<{ entry: LibraryEntry }>(path, { method: 'PUT', body })).entry
      },
      reconcile: (saved) => {
        entry.value = saved
      },
    })
  }

  /** Removes the work from the reading list. */
  function remove() {
    return run({
      send: () => api.request(path, { method: 'DELETE' }),
      reconcile: () => {
        entry.value = null
      },
    })
  }

  return { entry, isLoaded, isBusy, errorKey, load, save, remove }
}
