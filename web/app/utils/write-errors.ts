/** Messages shown when a write to the API fails (pure logic, tested without Nuxt). */
import type { ErrorCode } from '../contract/api'

/** Translation key of the message shown for each handled API error code. */
const WRITE_ERROR_KEYS = new Map<ErrorCode, string>([
  ['UNAUTHENTICATED', 'writeError.signedOut'],
  ['HANDLE_REQUIRED', 'writeError.signedOut'],
  ['NOT_FOUND', 'writeError.notFound'],
  ['RATE_LIMITED', 'error.RATE_LIMITED'],
])

/** Advice shown under a failed save that can simply be replayed. */
export const RETRY_HINT_KEY = 'writeError.retryHint'

/** Failures of the server or the network, not of the request: replaying the write may succeed. */
const TRANSIENT_CODES = new Set<ErrorCode>(['INTERNAL_ERROR', 'RATE_LIMITED'])

/** Whether "Retry" makes sense: any other refusal comes back identical until the user fixes the cause. */
export function isRetryable(code: ErrorCode): boolean {
  return TRANSIENT_CODES.has(code)
}

/** Translation key of the message to display for an API error code. */
export function writeErrorKey(code: ErrorCode): string {
  return WRITE_ERROR_KEYS.get(code) ?? 'writeError.generic'
}

/** Key of the "try again" advice that follows the generic message; the other codes have none. */
export function writeErrorHintKey(code: ErrorCode): string | undefined {
  return WRITE_ERROR_KEYS.has(code) ? undefined : RETRY_HINT_KEY
}
