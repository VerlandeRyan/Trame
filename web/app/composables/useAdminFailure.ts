/** Reaction to a failed administration write: a toast with "Retry", or the key of an inline message. */
import { toApiError } from '~/utils/api-error'
import { describeWriteFailure } from '~/utils/write-errors'

/**
 * A failure of the server or the network is announced by `useWriteFailure`, whose "Retry" replays
 * the write; a refusal the user must fix (invalid field, record changed meanwhile…) is not a
 * toast: its message key is returned, for the form to show.
 */
export function useAdminFailure() {
  const showWriteFailure = useWriteFailure()
  const api = useApi()

  return (cause: unknown, retry: () => void): string | undefined => {
    if (!describeWriteFailure(toApiError(cause).code).isRetryable) {
      return adminErrorKey(cause, api.messageKeyFor)
    }
    showWriteFailure(cause, retry)
    return undefined
  }
}
