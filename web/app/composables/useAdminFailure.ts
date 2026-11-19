/** Reaction to a failed administration write: a toast with "Retry", or the key of an inline message. */
import type { ApiError } from '~/utils/api-error'
import { isRetryable, writeErrorHintKey, writeErrorKey } from '~/utils/write-errors'

/**
 * A failure of the server or the network is announced by an error toast whose "Retry" replays the
 * write; a refusal the user must fix (invalid field, record changed meanwhile…) is not a toast:
 * its message key is returned, for the form to show.
 */
export function useAdminFailure() {
  const { show } = useToasts()
  const api = useApi()

  return (cause: unknown, retry: () => void): string | undefined => {
    // `useApi().request` only throws `ApiError`s.
    const { code } = cause as ApiError
    if (!isRetryable(code)) return adminErrorKey(cause, api.messageKeyFor)
    show({
      tone: 'error',
      messageKey: writeErrorKey(code),
      hintKey: writeErrorHintKey(code),
      retry,
    })
    return undefined
  }
}
