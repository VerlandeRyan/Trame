/**
 * Queue of write requests: they go out one after another (chained "+1" never cross). `isLatest`
 * tells whether the running request is the last one asked for: only its response, the server's,
 * should replace the displayed state.
 */
export function useRequestQueue(handlers: {
  /** Before each request (for example clear the previous error). */
  onStart: () => void
  /** A request failed: the screen may have drifted from the server. */
  onError: (cause: unknown) => Promise<void> | void
}) {
  const isBusy = ref(false)
  let pendingCount = 0
  let queue: Promise<void> = Promise.resolve()

  /** Adds a task after those already queued. */
  function enqueue(task: () => Promise<void>): Promise<void> {
    pendingCount += 1
    isBusy.value = true
    queue = queue
      .then(() => {
        handlers.onStart()
        return task()
      })
      .catch(handlers.onError)
      .finally(() => {
        pendingCount -= 1
        isBusy.value = pendingCount > 0
      })
    return queue
  }

  /** Whether the running request is the last one asked for. */
  const isLatest = () => pendingCount === 1

  return { enqueue, isBusy, isLatest }
}
