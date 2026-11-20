/** Pure rules of the toast stack: what is kept, replaced and how long it stays. */

/** Meaning of a toast; sets its colour and how it is announced. */
export type ToastTone = 'info' | 'success' | 'error'

/**
 * The button of a toast: "Retry" replays a failed write, "Undo" reverts what was just done. Both
 * act on the page that showed the toast, which closes when the page changes.
 */
export interface ToastAction {
  kind: 'retry' | 'undo'
  run: () => void
}

/** One announcement shown at the bottom of the screen. */
export interface Toast {
  id: number
  tone: ToastTone
  /** Translation key of the message. */
  messageKey: string
  /** Translation key of a second sentence (advice), shown under the message on wide screens. */
  hintKey?: string
  action?: ToastAction
  /** Stays until closed (or removed by whoever showed it): the information lasts. */
  isSticky?: boolean
}

/** Most announcements shown at once; the oldest ones give way. */
export const MAX_TOASTS = 3

/** How long an information or success toast stays on screen. */
const AUTO_DISMISS_MS = 5000

/** An error stays longer: the reader may need it to retry. */
const LONG_DISMISS_MS = 10000

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

/** Removes the toasts that offer a button: its action belongs to the page that showed it. */
export function removeActionToasts(toasts: Toast[]): Toast[] {
  return toasts.some((each) => each.action) ? toasts.filter((each) => !each.action) : toasts
}

/** Delay before a banner or toast of this tone hides itself; the countdown bar lasts as long. */
export function autoDismissDelay(tone: ToastTone): number {
  return tone === 'error' ? LONG_DISMISS_MS : AUTO_DISMISS_MS
}

/** Delay before a toast hides itself, `null` for a lasting piece of information (`isSticky`). */
export function toastDismissDelay(toast: Toast): number | null {
  return toast.isSticky ? null : autoDismissDelay(toast.tone)
}
