/** Announcement of a failed write: the single entry point that turns an error into a toast. */
import { toApiError } from '~/utils/api-error'
import { describeWriteFailure } from '~/utils/write-errors'

/** What a caller can add to the standard announcement of a failed write. */
interface WriteFailureOptions {
  /** Replays the write; offered as "Retry" only when it may succeed (see below). */
  retry?: () => void
  /** Replaces the standard message when the caller has a more precise one. */
  messageKey?: string
  /** The page the write started on, when it differs from where the function was created (an "Undo" made on the form, clicked on the list). */
  startedFrom?: string
}

/**
 * Returns the function that announces a failed write by an error toast. "Retry" (with its advice)
 * is offered only for a failure of the server or the network: any other refusal would come back
 * identical, nor once the page that started the write has been left.
 */
export function useWriteFailure() {
  const { show } = useToasts()
  const startedOn = useRoute().path
  const currentRoute = useRouter().currentRoute

  return (cause: unknown, options: WriteFailureOptions = {}): number => {
    const { retry, messageKey, startedFrom = startedOn } = options
    // An error that is not an `ApiError` (a network drop, a bug) counts as a server failure.
    const failure = describeWriteFailure(toApiError(cause).code)
    // A slow write can fail after the page was left: replaying it would act on a screen that is gone.
    const canRetry = failure.isRetryable && currentRoute.value.path === startedFrom
    return show({
      tone: 'error',
      messageKey: messageKey ?? failure.messageKey,
      hintKey: canRetry ? failure.hintKey : undefined,
      action: canRetry && retry ? { kind: 'retry', run: retry } : undefined,
    })
  }
}
