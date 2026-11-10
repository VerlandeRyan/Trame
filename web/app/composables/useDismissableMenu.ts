/** Menu closed by a click outside `root` or by Escape (focus then returns to the button). */
export function useDismissableMenu(root: Ref<HTMLElement | null>, focusTrigger: () => void) {
  const isOpen = ref(false)

  /** Closes the menu, optionally giving focus back to its button. */
  function close({ restoreFocus = false } = {}) {
    isOpen.value = false
    if (restoreFocus) focusTrigger()
  }

  /** Closes the menu when the click lands outside it. */
  function closeOnOutsideClick(event: MouseEvent) {
    if (isOpen.value && !root.value?.contains(event.target as Node)) close()
  }

  // Listens on the document: Safari does not focus a clicked button.
  /** Closes the menu on Escape, giving focus back to the trigger. */
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
