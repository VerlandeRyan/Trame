/** Shared toast stack: announcements shown at the bottom of the screen. */
import { addToast, removeRetryToasts, removeToast, type Toast } from '~/utils/toasts'

/** What a caller gives to show a toast; the id is assigned here. */
type ToastInput = Omit<Toast, 'id'>

/**
 * Announcements (information, success, error with an optional "Retry"), displayed by `UiToasts`,
 * whose items hide themselves after their delay.
 */
export function useToasts() {
  const toasts = useState<Toast[]>('toasts', () => [])
  const lastId = useState('toasts-last-id', () => 0)

  /** Hides a toast. */
  function dismiss(id: number) {
    toasts.value = removeToast(toasts.value, id)
  }

  /** Shows a toast and returns its id. */
  function show(input: ToastInput): number {
    const id = ++lastId.value
    toasts.value = addToast(toasts.value, { ...input, id })
    return id
  }

  /** Hides every toast that offers "Retry" (called when the page changes). */
  function dismissRetryable() {
    toasts.value = removeRetryToasts(toasts.value)
  }

  /** Closes the toast, then replays its action. */
  function retry(id: number) {
    const action = toasts.value.find((each) => each.id === id)?.retry
    dismiss(id)
    action?.()
  }

  return { toasts, show, dismiss, dismissRetryable, retry }
}
