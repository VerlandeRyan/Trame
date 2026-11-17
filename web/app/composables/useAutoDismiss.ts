/**
 * Calls `dismiss` once `durationMs` has elapsed, except while the element is hovered (mouse only)
 * or focused: the time left is kept. Returns the paused state, for the countdown bar, and the
 * listeners to put on the element (`v-on="pauseListeners"`).
 */
export function useAutoDismiss(durationMs: number, dismiss: () => void) {
  const isHovered = ref(false)
  const hasFocus = ref(false)
  const isPaused = computed(() => isHovered.value || hasFocus.value)

  let remainingMs = durationMs
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Starts (or restarts) the countdown with the time left. */
  function startTimer() {
    startedAt = Date.now()
    timer = setTimeout(dismiss, remainingMs)
  }

  /** Stops the countdown and keeps the time left. */
  function stopTimer() {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    remainingMs -= Date.now() - startedAt
  }

  // The timer only runs in the browser: an element rendered on the server starts it once mounted.
  onMounted(startTimer)
  onBeforeUnmount(stopTimer)
  watch(isPaused, (paused) => (paused ? stopTimer() : startTimer()))

  const pauseListeners = {
    pointerenter: (event: PointerEvent) => (isHovered.value = event.pointerType === 'mouse'),
    pointerleave: () => (isHovered.value = false),
    focusin: () => (hasFocus.value = true),
    focusout: () => (hasFocus.value = false),
  }

  return { isPaused, pauseListeners }
}
