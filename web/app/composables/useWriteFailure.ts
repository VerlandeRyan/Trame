/** Announcement of a failed write: the single entry point that turns an error into a toast. */
import { toApiError } from '~/utils/api-error'
import { describeWriteFailure } from '~/utils/write-errors'

/**
 * Returns the function that announces a failed write by an error toast. "Retry" (with its advice)
 * is offered only for a failure of the server or the network: any other refusal would come back
 * identical. `messageKey` replaces the standard message when the caller has a more precise one.
 */
export function useWriteFailure() {
  const { show } = useToasts()

  return (cause: unknown, retry?: () => void, messageKey?: string): number => {
    // An error that is not an `ApiError` (a network drop, a bug) counts as a server failure.
    const failure = describeWriteFailure(toApiError(cause).code)
    return show({
      tone: 'error',
      messageKey: messageKey ?? failure.messageKey,
      hintKey: failure.hintKey,
      retry: failure.isRetryable ? retry : undefined,
    })
  }
}
