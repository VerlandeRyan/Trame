/** Shared toast stack: announcements shown at the bottom of the screen. */
import { addToast, removeActionToasts, removeToast, type Toast } from '~/utils/toasts'

/** What a caller gives to show a toast; the id is assigned here. */
type ToastInput = Omit<Toast, 'id'>

/**
 * Announcements (information, success, error; with an optional "Retry" or "Undo" button),
 * displayed by `UiToasts`, whose items hide themselves after their delay.
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

  /** Hides every toast that offers a "Retry" or "Undo" button (called when the page changes). */
  function dismissActionable() {
    toasts.value = removeActionToasts(toasts.value)
  }

  /** Closes the toast, then runs its button's action. */
  function runAction(id: number) {
    const action = toasts.value.find((each) => each.id === id)?.action
    dismiss(id)
    action?.run()
  }

  return { toasts, show, dismiss, dismissActionable, runAction }
}
