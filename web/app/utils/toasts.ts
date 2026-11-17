/** Pure rules of the toast stack: what is kept, replaced and how long it stays. */

/** Meaning of a toast; sets its colour and how it is announced. */
export type ToastTone = 'info' | 'success' | 'error'

/** One announcement shown at the bottom of the screen. */
export interface Toast {
  id: number
  tone: ToastTone
  /** Translation key of the message. */
  messageKey: string
  /** Translation key of a second sentence (advice), shown under the message on wide screens. */
  hintKey?: string
  /** Replays the failed action; shown as a "Retry" button. */
  retry?: () => void
}

/** Most announcements shown at once; the oldest ones give way. */
export const MAX_TOASTS = 3

/** How long an information or success toast stays on screen. */
const AUTO_DISMISS_MS = 5000

/** An error stays longer: the reader may need it to retry. */
const ERROR_DISMISS_MS = 10000

/** Adds a toast; an identical one (same tone and message) is replaced, not stacked. */
export function addToast(toasts: Toast[], toast: Toast): Toast[] {
  const others = toasts.filter(
    (each) => each.tone !== toast.tone || each.messageKey !== toast.messageKey,
  )
  return [...others, toast].slice(-MAX_TOASTS)
}

/** Removes the toast with this id. */
export function removeToast(toasts: Toast[], id: number): Toast[] {
  return toasts.filter((each) => each.id !== id)
}

/** Delay before a toast hides itself; the countdown bar lasts as long. */
export function autoDismissDelay(tone: ToastTone): number {
  return tone === 'error' ? ERROR_DISMISS_MS : AUTO_DISMISS_MS
}
