/** Announcement of a failed write: the single entry point that turns an error into a toast. */
import { toApiError } from '~/utils/api-error'
import { describeWriteFailure } from '~/utils/write-errors'

/**
 * Returns the function that announces a failed write by an error toast. "Retry" (with its advice)
 * is offered only for a failure of the server or the network: any other refusal would come back
 * identical, nor once the page that started the write has been left. `messageKey` replaces the
 * standard message when the caller has a more precise one.
 */
export function useWriteFailure() {
  const { show } = useToasts()
  const startedOn = useRoute().path
  const currentRoute = useRouter().currentRoute

  return (cause: unknown, retry?: () => void, messageKey?: string): number => {
    // An error that is not an `ApiError` (a network drop, a bug) counts as a server failure.
    const failure = describeWriteFailure(toApiError(cause).code)
    // A slow write can fail after the page was left: replaying it would act on a screen that is gone.
    const canRetry = failure.isRetryable && currentRoute.value.path === startedOn
    return show({
      tone: 'error',
      messageKey: messageKey ?? failure.messageKey,
      hintKey: canRetry ? failure.hintKey : undefined,
      retry: canRetry ? retry : undefined,
    })
  }
}
