/** A reading list: paginated loading and immediate, server-reconciled edits. */
import { LIBRARY_STATUSES, type LibraryEntry, type LibraryEntryChanges } from '~/utils/library'
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

/** Status counts all at zero, used before the first page arrives. */
const NO_STATUS_COUNTS = Object.fromEntries(
  LIBRARY_STATUSES.map((status) => [status, 0]),
) as StatusCounts

/**
 * A reading list (`source`: mine by default, or a member's read-only one): the first page is read
 * during server rendering (visitor's cookie forwarded), later pages on scroll, edits saved through
 * the entry endpoints. A change shows at once, counts and totals included, without reloading the
 * list; after a failure the first page is read again. Call before any other `await` of the page.
 */
export async function useReadingList(
  state: ComputedRef<ListState>,
  source: string = '/me/entries',
) {
  const api = useApi()
  const { locale } = useI18n()

  const items = ref<ListedEntry[]>([])
  const total = ref(0)
  const statusCounts = ref<StatusCounts>({ ...NO_STATUS_COUNTS })
  const totals = ref<ReadingTotals>({ chaptersRead: 0, volumesRead: 0 })
  const isLoadingMore = ref(false)
  const hasLoadMoreFailed = ref(false)
  let loadedPages = 0

  /** Reads one page of the list. */
  const fetchPage = (page: number) =>
    api.request<ListPage>(source, {
      query: toListApiQuery(state.value, { lang: locale.value, page }),
    })

  // Read again only when the query changes (tab, search, sort, language): switching between list
  // and grid keeps the pages already loaded.
  const firstPageQuery = computed(() =>
    JSON.stringify(toListApiQuery(state.value, { lang: locale.value, page: 1 })),
  )
  const { data, status, error, refresh } = await useAsyncData<ListPage>(
    `reading-list-${source}-${locale.value}`,
    () => fetchPage(1),
    { watch: [firstPageQuery] },
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

  /** Appends the next page, skipping works already shown. */
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

  // After a failure the list may have drifted from the server: read the first page again.
  const { run, isBusy, errorKey } = useOptimisticWrite({ resync: () => refresh() })

  /** Replaces the entry of a work in the displayed list. */
  function replaceEntryInView(workId: number, entry: LibraryEntry) {
    items.value = items.value.map((item) => (item.work.id === workId ? { ...item, entry } : item))
  }

  /** A work that changes tab or is removed leaves the displayed list. */
  function removeFromView(workId: number) {
    items.value = items.value.filter((item) => item.work.id !== workId)
    total.value -= 1
  }

  /** Tabs and totals follow a local change (`after` `null`: the work is removed). */
  function updateStatusCountsAndTotals(before: LibraryEntry, after: LibraryEntry | null) {
    const next = applyEntryChangeToCounts(
      { statusCounts: statusCounts.value, totals: totals.value },
      before,
      after,
    )
    statusCounts.value = next.statusCounts
    totals.value = next.totals
  }

  /** Applies `changes` to the entry (the status is always sent, the rest only when it changes). */
  function changeEntry(item: ListedEntry, changes: LibraryEntryChanges) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    const after = { ...before, ...changes }
    return run({
      apply: () => {
        updateStatusCountsAndTotals(before, after)
        replaceEntryInView(workId, after)
        if (!isInTab(after, state.value.status)) removeFromView(workId)
      },
      send: async () => {
        const body = { status: before.status, ...changes }
        return (
          await api.request<{ entry: LibraryEntry }>(`/works/${workId}/entry`, {
            method: 'PUT',
            body,
          })
        ).entry
      },
      // Only the dates can differ from what is displayed (the server proposes them).
      reconcile: (saved) => {
        if (items.value.some((each) => each.work.id === workId)) replaceEntryInView(workId, saved)
      },
    })
  }

  /** Removes a work from the list. */
  function removeEntry(item: ListedEntry) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    return run({
      apply: () => {
        updateStatusCountsAndTotals(before, null)
        removeFromView(workId)
      },
      send: () => api.request(`/works/${workId}/entry`, { method: 'DELETE' }),
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
