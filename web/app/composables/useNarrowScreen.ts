/** Vrai sur un écran de téléphone (< 768 px), mesuré après le montage pour un rendu serveur identique. */
export function useNarrowScreen() {
  const narrow = ref(false)
  let query: MediaQueryList | undefined
  const update = (event: MediaQueryListEvent) => {
    narrow.value = event.matches
  }

  onMounted(() => {
    query = window.matchMedia('(max-width: 767px)')
    narrow.value = query.matches
    query.addEventListener('change', update)
  })
  onBeforeUnmount(() => query?.removeEventListener('change', update))

  return narrow
}
