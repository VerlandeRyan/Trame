import type { ApiError } from '~/utils/api-error'
import {
  libraryErrorKey,
  LIBRARY_STATUSES,
  type LibraryEntry,
  type LibraryEntryChanges,
} from '~/utils/library'
import {
  applyEntryChangeToCounts,
  hasMorePages,
  isInTab,
  toListApiQuery,
  type ListedEntry,
  type ListPage,
  type ListState,
  type ReadingTotals,
  type StatusCounts,
} from '~/utils/reading-list'

const NO_STATUS_COUNTS = Object.fromEntries(
  LIBRARY_STATUSES.map((status) => [status, 0]),
) as StatusCounts

/**
 * Ma liste de lecture : première page lue dès le rendu serveur (cookie du visiteur transmis), pages
 * suivantes au défilement, modifications enregistrées par `PUT/DELETE /works/:id/entry`.
 * Un changement s'affiche aussitôt, compteurs et totaux compris, sans relire la liste ; en cas
 * d'échec la première page est relue. À appeler avant tout autre `await` de la page.
 */
export async function useReadingList(state: ComputedRef<ListState>) {
  const api = useApi()
  const route = useRoute()
  const { locale } = useI18n()
  const cookieHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const items = ref<ListedEntry[]>([])
  const total = ref(0)
  const statusCounts = ref<StatusCounts>({ ...NO_STATUS_COUNTS })
  const totals = ref<ReadingTotals>({ chaptersRead: 0, volumesRead: 0 })
  const errorKey = ref<string | null>(null)
  const isLoadingMore = ref(false)
  const hasLoadMoreFailed = ref(false)
  let loadedPages = 0

  const fetchPage = (page: number) =>
    api.request<ListPage>('/me/entries', {
      query: toListApiQuery(state.value, { lang: locale.value, page }),
      headers: cookieHeaders,
    })

  // Adresse + langue : la liste est relue quand l'une des deux change.
  const { data, status, error, refresh } = await useAsyncData<ListPage>(
    `reading-list-${locale.value}`,
    () => fetchPage(1),
    { watch: [() => route.fullPath, locale] },
  )

  watch(
    data,
    (page) => {
      items.value = page?.items ?? []
      total.value = page?.total ?? 0
      statusCounts.value = page?.statusCounts ?? { ...NO_STATUS_COUNTS }
      totals.value = page?.totals ?? { chaptersRead: 0, volumesRead: 0 }
      loadedPages = page ? 1 : 0
      hasLoadMoreFailed.value = false
    },
    { immediate: true },
  )

  const hasMore = computed(() => hasMorePages(items.value.length, total.value))

  async function loadMore() {
    if (isLoadingMore.value || !hasMore.value) return
    isLoadingMore.value = true
    hasLoadMoreFailed.value = false
    try {
      const next = await fetchPage(loadedPages + 1)
      const known = new Set(items.value.map((item) => item.work.id))
      items.value = [...items.value, ...next.items.filter((item) => !known.has(item.work.id))]
      loadedPages += 1
    } catch {
      hasLoadMoreFailed.value = true
    } finally {
      isLoadingMore.value = false
    }
  }

  const { enqueue, isBusy, isLatest } = useRequestQueue({
    onStart: () => {
      errorKey.value = null
    },
    onError: async (cause) => {
      errorKey.value = libraryErrorKey((cause as ApiError).code)
      await refresh()
    },
  })

  function replaceEntryInView(workId: number, entry: LibraryEntry) {
    items.value = items.value.map((item) => (item.work.id === workId ? { ...item, entry } : item))
  }

  /** Une œuvre qui change d'onglet ou qu'on retire quitte la liste affichée. */
  function removeFromView(workId: number) {
    items.value = items.value.filter((item) => item.work.id !== workId)
    total.value -= 1
  }

  /** Onglets et totaux suivent un changement local (`after` `null` : l'œuvre est retirée). */
  function updateStatusCountsAndTotals(before: LibraryEntry, after: LibraryEntry | null) {
    const next = applyEntryChangeToCounts(
      { statusCounts: statusCounts.value, totals: totals.value },
      before,
      after,
    )
    statusCounts.value = next.statusCounts
    totals.value = next.totals
  }

  /** Applique `changes` à l'entrée (le statut est toujours envoyé, le reste seulement s'il change). */
  function changeEntry(item: ListedEntry, changes: LibraryEntryChanges) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    const after = { ...before, ...changes }
    updateStatusCountsAndTotals(before, after)
    replaceEntryInView(workId, after)
    if (!isInTab(after, state.value.status)) removeFromView(workId)
    return enqueue(async () => {
      const body = { status: before.status, ...changes }
      const saved = (
        await api.request<{ entry: LibraryEntry }>(`/works/${workId}/entry`, {
          method: 'PUT',
          body,
        })
      ).entry
      // Seules les dates peuvent différer de ce qui est affiché (le serveur les propose).
      if (isLatest() && items.value.some((each) => each.work.id === workId)) {
        replaceEntryInView(workId, saved)
      }
    })
  }

  function removeEntry(item: ListedEntry) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    updateStatusCountsAndTotals(before, null)
    removeFromView(workId)
    return enqueue(async () => {
      await api.request(`/works/${workId}/entry`, { method: 'DELETE' })
    })
  }

  return {
    items,
    total,
    statusCounts,
    totals,
    status,
    error,
    errorKey,
    isBusy,
    isLoadingMore,
    hasLoadMoreFailed,
    hasMore,
    loadMore,
    changeEntry,
    removeEntry,
    refresh,
  }
}
