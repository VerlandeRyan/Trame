/** What to tell the reader when a write to the API fails (pure logic, tested without Nuxt). */
import type { ErrorCode } from '../contract/api'

/** Advice shown under a failed save that can simply be replayed. */
export const RETRY_HINT_KEY = 'writeError.retryHint'

/** How a failed write is announced: its message, its advice, and whether replaying may succeed. */
export interface WriteFailure {
  /** Translation key of the message. */
  messageKey: string
  /** Translation key of the advice that follows the message; only a replayable failure has one. */
  hintKey?: string
  /** Whether "Retry" makes sense: any refusal comes back identical until the user fixes the cause. */
  isRetryable: boolean
}

/** Failure of the server or the network, not of the request: replaying the write may succeed. */
const TRANSIENT_FAILURE: WriteFailure = {
  messageKey: 'writeError.generic',
  hintKey: RETRY_HINT_KEY,
  isRetryable: true,
}

/** Refusal that replaying cannot change and that has no message of its own. */
const GENERIC_REFUSAL: WriteFailure = { messageKey: 'writeError.generic', isRetryable: false }

/** The failure announced for each handled API error code; any other code is a generic refusal. */
const WRITE_FAILURES = new Map<ErrorCode, WriteFailure>([
  ['INTERNAL_ERROR', TRANSIENT_FAILURE],
  ['RATE_LIMITED', { messageKey: 'error.RATE_LIMITED', isRetryable: true }],
  ['UNAUTHENTICATED', { messageKey: 'writeError.signedOut', isRetryable: false }],
  ['HANDLE_REQUIRED', { messageKey: 'writeError.signedOut', isRetryable: false }],
  ['NOT_FOUND', { messageKey: 'writeError.notFound', isRetryable: false }],
])

/** The failure to announce for an API error code. */
export function describeWriteFailure(code: ErrorCode): WriteFailure {
  return WRITE_FAILURES.get(code) ?? GENERIC_REFUSAL
}
