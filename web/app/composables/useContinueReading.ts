/** State and actions of the home "Continue reading" strip. */
import { incrementUnit } from '~/utils/home'
import type { LibraryEntry, LibraryEntryChanges } from '~/utils/library'
import type { ListedEntry } from '~/utils/reading-list'

/**
 * Home "Continue reading" strip: a +1 shows at once and is then saved (one request at a time).
 * Finishing the work asks for confirmation first (`useReadingPrompt`); a work that is no longer
 * "reading" leaves the strip. A failure restores the previous entry.
 */
export function useContinueReading(initialItems: () => ListedEntry[]) {
  const api = useApi()
  const items = ref<ListedEntry[]>([])
  const readingPrompt = useReadingPrompt()
  const { run, errorKey } = useOptimisticWrite()

  watch(initialItems, (entries) => (items.value = entries), { immediate: true })

  /** Replaces the entry of a work in the strip. */
  function replaceEntry(workId: number, entry: LibraryEntry) {
    items.value = items.value.map((item) => (item.work.id === workId ? { ...item, entry } : item))
  }

  /** Shows the changes at once, saves them, and restores the previous entry on failure. */
  function saveChanges(item: ListedEntry, changes: LibraryEntryChanges) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    const after = { ...before, ...changes }
    return run({
      apply: () => {
        replaceEntry(workId, after)
        if (after.status !== 'reading') {
          items.value = items.value.filter((each) => each.work.id !== workId)
        }
      },
      send: async () =>
        (
          await api.request<{ entry: LibraryEntry }>(`/works/${workId}/entry`, {
            method: 'PUT',
            body: { status: before.status, ...changes },
          })
        ).entry,
      reconcile: (saved) => replaceEntry(workId, saved),
      revert: () => {
        if (items.value.some((each) => each.work.id === workId)) replaceEntry(workId, before)
      },
    })
  }

  /** +1 on chapters, or on volumes for a work followed by volumes only. */
  function addOneToProgress(item: ListedEntry) {
    const { chaptersRead, volumesRead } = item.entry
    const changes: LibraryEntryChanges =
      incrementUnit(item.entry) === 'chapters'
        ? { chaptersRead: chaptersRead + 1 }
        : { volumesRead: volumesRead + 1 }
    const totals = { chapters: item.work.chapters, volumes: item.work.volumes }
    const isAsking = readingPrompt.request(item.entry, totals, changes, {
      apply: (confirmed) => saveChanges(item, confirmed),
      discard: () => undefined,
    })
    if (!isAsking) void saveChanges(item, changes)
  }

  return { items, errorKey, readingPrompt, addOneToProgress }
}
