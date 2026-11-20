/** Writes whose effect shows immediately, sent in order and reconciled with the server. */
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
  /**
   * Names a value this step overwrites completely (a counter): when a later step with the same
   * key succeeds, the failure of this one no longer matters and its toast goes away.
   */
  overwriteKey?: string
  /**
   * Success toast shown once the request went through: a message key, or a key with an "Undo".
   */
  announce?: string | { messageKey: string; undo?: () => void }
}

/**
 * Write with immediate effect: the change shows at once, requests go out one after another and
 * only the last response replaces the display. A success may be announced (`announce`). A failure
 * is announced by an error toast (with a "Retry" button that replays the step when the failure may
 * be transient, see `showWriteFailure`), then the screen is put right (the step's `revert`,
 * otherwise `resync`).
 */
export function useOptimisticWrite(options: { resync?: () => Promise<void> } = {}) {
  const { dismiss, show } = useToasts()
  const showWriteFailure = useWriteFailure()
  /** The last failure announced, with the value its step overwrote, if any. */
  let lastFailure: { toastId: number; overwriteKey?: string } | null = null

  const { enqueue, isBusy, isLatest } = useRequestQueue({
    // Failures are handled in `run`, where `revert` is known.
    onError: () => undefined,
  })

  /** Announces the failure with a way to replay the step, then restores the screen. */
  async function recoverFrom<Result>(cause: unknown, step: OptimisticStep<Result>) {
    const toastId = showWriteFailure(cause, {
      // With a newer write already queued, replaying this one would overwrite it.
      retry: isLatest() ? () => void run(step) : undefined,
    })
    lastFailure = { toastId, overwriteKey: step.overwriteKey }
    const { revert } = step
    if (revert) return revert()
    try {
      await options.resync?.()
    } catch {
      // The error toast is already shown; the display stays as it is.
    }
  }

  /** A successful step that overwrote the same value makes the earlier failure moot. */
  function dismissFailureOverwrittenBy<Result>(step: OptimisticStep<Result>) {
    const failure = lastFailure
    if (failure?.overwriteKey === undefined || failure.overwriteKey !== step.overwriteKey) return
    dismiss(failure.toastId)
    lastFailure = null
  }

  /** Applies the step now and queues its request; a newer write cancels the previous "Retry". */
  function run<Result>(step: OptimisticStep<Result>): Promise<void> {
    // Replaying an older step would overwrite what the reader has done since.
    if (lastFailure) dismiss(lastFailure.toastId)
    lastFailure = null
    step.apply?.()
    return enqueue(async () => {
      try {
        const result = await step.send()
        dismissFailureOverwrittenBy(step)
        if (step.announce) {
          const { messageKey, undo } =
            typeof step.announce === 'string' ? { messageKey: step.announce } : step.announce
          show({ tone: 'success', messageKey, action: undo && { kind: 'undo', run: undo } })
        }
        if (isLatest()) step.reconcile?.(result)
      } catch (cause) {
        await recoverFrom(cause, step)
      }
    })
  }

  return { run, isBusy }
}
