/** What infinite scrolling reads from a list (see `useReadingList`). */
interface LoadableList {
  hasMore: Readonly<Ref<boolean>>
  hasLoadMoreFailed: Readonly<Ref<boolean>>
  loadMore: () => Promise<void>
}

/**
 * Infinite scrolling: the next page loads when the returned marker, placed under the list, nears
 * the bottom of the screen; one more page as long as it stays in view (a short page does not push it out).
 */
export function useLoadMoreOnScroll(list: LoadableList) {
  const sentinel = ref<HTMLElement | null>(null)
  let observer: IntersectionObserver | undefined

  /** Whether the marker is above the bottom edge of the window. */
  const isSentinelInView = () =>
    (sentinel.value?.getBoundingClientRect().top ?? Infinity) < innerHeight

  /** Loads pages one after another while the marker stays visible. */
  async function loadMoreWhileSentinelVisible(): Promise<void> {
    const canLoadMore = list.hasMore.value && !list.hasLoadMoreFailed.value && isSentinelInView()
    if (!canLoadMore) return
    await list.loadMore()
    return loadMoreWhileSentinelVisible()
  }

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreWhileSentinelVisible()
      },
      { rootMargin: '300px' },
    )
    if (sentinel.value) observer.observe(sentinel.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return sentinel
}
