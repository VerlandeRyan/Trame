/** Messages shown when a write to the API fails (pure logic, tested without Nuxt). */

/** Translation key of the message shown for each handled API error code. */
const WRITE_ERROR_KEYS = new Map([
  ['UNAUTHENTICATED', 'writeError.signedOut'],
  ['HANDLE_REQUIRED', 'writeError.signedOut'],
  ['NOT_FOUND', 'writeError.notFound'],
  ['RATE_LIMITED', 'error.RATE_LIMITED'],
])

/** Advice shown under a failed save that can simply be replayed. */
export const RETRY_HINT_KEY = 'writeError.retryHint'

/** Translation key of the message to display for an API error code. */
export function writeErrorKey(code: string): string {
  return WRITE_ERROR_KEYS.get(code) ?? 'writeError.generic'
}

/** Key of the "try again" advice that follows the generic message; the other codes have none. */
export function writeErrorHintKey(code: string): string | undefined {
  return WRITE_ERROR_KEYS.has(code) ? undefined : RETRY_HINT_KEY
}
