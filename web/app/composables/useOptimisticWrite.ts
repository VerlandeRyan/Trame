/** Writes whose effect shows immediately, sent in order and reconciled with the server. */
import type { ApiError } from '~/utils/api-error'
import { libraryErrorKey } from '~/utils/library'

/** One optimistic write: what to show, what to send and how to recover. */
interface OptimisticStep<Result> {
  /** Changes the display at once, before the server answers. */
  apply?: () => void
  /** The write request, sent after those already on their way. */
  send: () => Promise<Result>
  /** Receives the server's answer, only if no more recent request is on its way. */
  reconcile?: (result: Result) => void
  /** Restores the previous display; without it, `resync` realigns the screen with the server. */
  revert?: () => void
}

/**
 * Write with immediate effect: the change shows at once, requests go out one after another and
 * only the last response replaces the display. A failure is announced by `errorKey`, then the
 * screen is put right (the step's `revert`, otherwise `resync`).
 */
export function useOptimisticWrite(options: { resync?: () => Promise<void> } = {}) {
  const errorKey = ref<string | null>(null)

  const { enqueue, isBusy, isLatest } = useRequestQueue({
    onStart: () => {
      errorKey.value = null
    },
    // Failures are handled in `run`, where `revert` is known.
    onError: () => undefined,
  })

  /** Announces the failure, then restores the screen. */
  async function recoverFrom(cause: unknown, revert: (() => void) | undefined) {
    errorKey.value = libraryErrorKey((cause as ApiError).code)
    if (revert) return revert()
    try {
      await options.resync?.()
    } catch {
      // The error message is already shown; the display stays as it is.
    }
  }

  /** Applies the step now and queues its request. */
  function run<Result>(step: OptimisticStep<Result>): Promise<void> {
    step.apply?.()
    return enqueue(async () => {
      try {
        const result = await step.send()
        if (isLatest()) step.reconcile?.(result)
      } catch (cause) {
        await recoverFrom(cause, step.revert)
      }
    })
  }

  return { run, isBusy, errorKey }
}
