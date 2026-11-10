/**
 * True on a phone-sized screen (≤ 767 px by default, or up to `maxWidth`), measured after
 * mounting so the server render stays identical.
 */
export function useNarrowScreen(maxWidth = 767) {
  const narrow = ref(false)
  let query: MediaQueryList | undefined
  /** Follows the media query. */
  const update = (event: MediaQueryListEvent) => {
    narrow.value = event.matches
  }

  onMounted(() => {
    query = window.matchMedia(`(max-width: ${maxWidth}px)`)
    narrow.value = query.matches
    query.addEventListener('change', update)
  })
  onBeforeUnmount(() => query?.removeEventListener('change', update))

  return narrow
}
