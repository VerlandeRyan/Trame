/** Announces the loss and the return of the network connection. */

/**
 * Tells while the calling page is mounted that the connection is lost (an information toast that
 * stays until it is back: writes will fail meanwhile) and that it is back (a success). The browser
 * fires no event for a page opened while already offline, so the state is read once on mount.
 */
export function useConnectionAnnouncements() {
  const { show, dismiss } = useToasts()
  let offlineToastId: number | undefined

  /** Tells that the connection is lost. */
  const announceOffline = () => {
    offlineToastId = show({ tone: 'info', messageKey: 'toast.offline', isSticky: true })
  }
  /** Tells that the connection is back, and takes the "offline" toast down. */
  const announceOnline = () => {
    if (offlineToastId !== undefined) dismiss(offlineToastId)
    offlineToastId = undefined
    show({ tone: 'success', messageKey: 'toast.backOnline' })
  }

  onMounted(() => {
    if (!navigator.onLine) announceOffline()
    window.addEventListener('offline', announceOffline)
    window.addEventListener('online', announceOnline)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('offline', announceOffline)
    window.removeEventListener('online', announceOnline)
  })
}
