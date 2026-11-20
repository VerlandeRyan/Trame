/** A reading list: paginated loading and immediate, server-reconciled edits. */
import {
  LIBRARY_STATUSES,
  singleCounterOf,
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
  // Created before the first `await`, which loses the Nuxt context that `useToasts` needs. The
  // reload function is filled in once the first page is loaded: after a failure the list may have
  // drifted from the server, so that page is read again.
  const listReloader: { reload?: () => Promise<void> } = {}
  const { run, isBusy } = useOptimisticWrite({
    resync: async () => {
      await listReloader.reload?.()
    },
  })

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
  listReloader.reload = () => refresh()

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

  /**
   * Applies `changes` to the entry (the status is always sent, the rest only when it changes).
   * `announceKey` is a success toast shown once saved: for a grouped edit or a confirmed question,
   * not for a "+1" whose result is already on screen.
   */
  function changeEntry(item: ListedEntry, changes: LibraryEntryChanges, announceKey?: string) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    const after = { ...before, ...changes }
    const counter = singleCounterOf(changes)
    return run({
      overwriteKey: counter && `${workId}:${counter}`,
      announce: announceKey,
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

  /** Puts back a removed entry exactly as it was, then reads the list again to show it. */
  function restoreEntry(workId: number, removed: LibraryEntry) {
    return run({
      announce: 'toast.entryRestored',
      // `restored`: the removal kept the journal, so the API must not log this progress again.
      send: () =>
        api.request(`/works/${workId}/entry`, {
          method: 'PUT',
          body: { ...removed, restored: true },
        }),
      reconcile: () => void refresh(),
    })
  }

  /** Removes a work from the list, then announces it with an "Undo". */
  function removeEntry(item: ListedEntry) {
    const workId = item.work.id
    const before = items.value.find((each) => each.work.id === workId)?.entry ?? item.entry
    return run({
      announce: {
        messageKey: 'toast.entryRemoved',
        undo: () => void restoreEntry(workId, before),
      },
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
