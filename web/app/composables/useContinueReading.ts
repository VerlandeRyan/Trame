import { incrementUnit } from '~/utils/home'
import type { LibraryEntry, LibraryEntryChanges } from '~/utils/library'
import type { ListedEntry } from '~/utils/reading-list'

/**
 * Bande « Reprendre la lecture » de l'accueil : un +1 s'affiche aussitôt puis s'enregistre par
 * `PUT /works/:id/entry` (une requête à la fois). Finir l'œuvre demande d'abord confirmation
 * (`useReadingPrompt`) ; une œuvre qui n'est plus « En cours » quitte la bande. Un échec remet
 * l'entrée d'avant.
 */
export function useContinueReading(initialItems: () => ListedEntry[]) {
  const api = useApi()
  const items = ref<ListedEntry[]>([])
  const readingPrompt = useReadingPrompt()
  const { run, errorKey } = useOptimisticWrite()

  watch(initialItems, (entries) => (items.value = entries), { immediate: true })

  function replaceEntry(workId: number, entry: LibraryEntry) {
    items.value = items.value.map((item) => (item.work.id === workId ? { ...item, entry } : item))
  }

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

  /** +1 sur les chapitres, ou sur les tomes pour une œuvre suivie seulement par tomes. */
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
