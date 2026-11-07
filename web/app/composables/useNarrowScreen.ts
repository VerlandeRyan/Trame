/**
 * Vrai sur un écran de téléphone (≤ 767 px par défaut, ou jusqu'à `maxWidth`), mesuré après le
 * montage pour un rendu serveur identique.
 */
export function useNarrowScreen(maxWidth = 767) {
  const narrow = ref(false)
  let query: MediaQueryList | undefined
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
