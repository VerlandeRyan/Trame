/** The work a visitor tried to add before signing in, kept in the tab to add it on return. */

/** Key of the remembered work in the tab's session storage. */
const PENDING_ADD_KEY = 'trame.pending-add'

/** How long the intent stays valid: long enough to sign in, short enough to be forgotten. */
export const PENDING_ADD_TTL_MS = 10 * 60 * 1000

/** The part of `Storage` this module needs, so tests can pass a fake. */
export type PendingAddStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The tab's session storage, or `null` where the browser refuses access to it. */
export function tabStorage(): PendingAddStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Remembers the work to add after sign-in; without usable storage the visitor adds it again. */
export function rememberPendingAdd(workId: number, now = Date.now(), storage = tabStorage()): void {
  try {
    storage?.setItem(PENDING_ADD_KEY, JSON.stringify({ workId, at: now }))
  } catch {
    // Storage can still throw when full or blocked: same fallback.
  }
}

/** Returns the remembered work once and forgets it; `null` if none, expired or unreadable. */
export function takePendingAdd(now = Date.now(), storage = tabStorage()): number | null {
  try {
    const raw = storage?.getItem(PENDING_ADD_KEY)
    if (raw === null || raw === undefined) return null
    storage?.removeItem(PENDING_ADD_KEY)
    const { workId, at } = JSON.parse(raw) as { workId?: unknown; at?: unknown }
    if (typeof workId !== 'number' || typeof at !== 'number') return null
    return now - at <= PENDING_ADD_TTL_MS ? workId : null
  } catch {
    return null
  }
}
