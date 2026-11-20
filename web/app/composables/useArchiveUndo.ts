/** Announcement of an archived or restored catalogue record, with an "Undo" on the archiving. */
import {
  ADMIN_DRAFT_COUNTS_KEY,
  adminArchivesKey,
  adminListKey,
  parseAdminListQuery,
} from '~/utils/admin'

/**
 * Returns the function that announces an archiving (success toast whose "Undo" restores the
 * record) or a restoration (plain success toast). The undo is a write like any other: its failure
 * is announced by `useWriteFailure`, with "Retry" only for a failure of the server or the network.
 * Once an undo went through, the reads of the catalogue list shown at that moment are read again.
 */
export function useArchiveUndo() {
  const { show } = useToasts()
  const client = useAdminClient()
  const showWriteFailure = useWriteFailure()
  const router = useRouter()

  // The toast closes with its page, so "Undo" is clicked on the list: its reads are named by its address.
  /** Reads again the catalogue list, its archive count and its draft count. */
  const refreshAdminLists = () => {
    const query = parseAdminListQuery(router.currentRoute.value.query)
    return refreshNuxtData([
      adminListKey(query),
      adminArchivesKey(query.kind),
      ADMIN_DRAFT_COUNTS_KEY,
    ])
  }

  /** Restores the record when "Undo" is clicked. */
  async function undoArchive(kind: AdminKind, id: number) {
    const clickedOn = router.currentRoute.value.path
    try {
      await client.restore(kind, id)
    } catch (cause) {
      showWriteFailure(cause, {
        retry: () => void undoArchive(kind, id),
        startedFrom: clickedOn,
      })
      return
    }
    show({ tone: 'success', messageKey: 'toast.recordRestored' })
    await refreshAdminLists()
  }

  return function announceArchiveChange(kind: AdminKind, id: number, archived: boolean) {
    if (!archived) return show({ tone: 'success', messageKey: 'toast.recordRestored' })
    return show({
      tone: 'success',
      messageKey: 'toast.recordArchived',
      action: { kind: 'undo', run: () => void undoArchive(kind, id) },
    })
  }
}
