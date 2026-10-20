/** Menu fermé par un clic à l'extérieur de `root` ou par Échap (le focus revient alors au bouton). */
export function useDismissableMenu(root: Ref<HTMLElement | null>, focusTrigger: () => void) {
  const isOpen = ref(false)

  function close({ restoreFocus = false } = {}) {
    isOpen.value = false
    if (restoreFocus) focusTrigger()
  }

  function closeOnOutsideClick(event: MouseEvent) {
    if (isOpen.value && !root.value?.contains(event.target as Node)) close()
  }

  // Sur le document : Safari ne donne pas le focus à un bouton cliqué.
  function closeOnEscape(event: KeyboardEvent) {
    if (isOpen.value && event.key === 'Escape') close({ restoreFocus: true })
  }

  onMounted(() => {
    document.addEventListener('click', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('click', closeOnOutsideClick)
    document.removeEventListener('keydown', closeOnEscape)
  })

  return { isOpen, close }
}
