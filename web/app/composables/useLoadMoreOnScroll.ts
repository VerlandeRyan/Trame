/** Ce que le défilement continu lit d'une liste (`useReadingList`). */
interface LoadableList {
  hasMore: Readonly<Ref<boolean>>
  hasLoadMoreFailed: Readonly<Ref<boolean>>
  loadMore: () => Promise<void>
}

/**
 * Défilement continu : la suite se charge quand le repère renvoyé, placé sous la liste, approche
 * du bas de l'écran ; une page de plus tant qu'il y reste (une page courte ne le fait pas sortir).
 */
export function useLoadMoreOnScroll(list: LoadableList) {
  const sentinel = ref<HTMLElement | null>(null)
  let observer: IntersectionObserver | undefined

  const isSentinelInView = () =>
    (sentinel.value?.getBoundingClientRect().top ?? Infinity) < innerHeight

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
