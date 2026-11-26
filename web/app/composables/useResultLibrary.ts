/** Which works of a results page are in the reader's list, and the addition of a work from there. */
import { DEFAULT_LIBRARY_STATUS } from '~/utils/library'
import { rememberPendingAdd, takePendingAdd } from '~/utils/pending-add'

/** Where the composable reads the page it works on. */
interface ResultLibrarySource {
  /** Works of the page already in the list, read with the page; `null` if that read failed. */
  loaded: () => number[] | null | undefined
  /** Works of the displayed page. */
  workIds: () => number[]
  /** Loads the page again: the retry offered when the list could not be read. */
  reload: () => void
}

/** Reads which of the given works are in the reader's list; `null` when the read failed. */
export async function fetchListedWorkIds(
  api: ReturnType<typeof useApi>,
  workIds: number[],
): Promise<number[] | null> {
  if (workIds.length === 0) return []
  try {
    const response = await api.request<{ workIds: number[] }>('/me/entries/listed', {
      query: { ids: workIds.join(',') },
    })
    return response.workIds
  } catch {
    return null
  }
}

/** `listed` with the work added, or removed. */
function withWork(listed: ReadonlySet<number>, workId: number, isListed: boolean) {
  const next = new Set(listed)
  if (isListed) next.add(workId)
  else next.delete(workId)
  return next
}

/**
 * Which works of a results page are in the reader's list, and the addition of a work from there;
 * a visitor who chooses "Add" signs in first, and the work is added once they are back. An
 * addition shows at once and is sent in order; a page read while one is still on its way does not
 * undo it, and after a failure the list is read again.
 */
export function useResultLibrary(source: ResultLibrarySource) {
  const api = useApi()
  const { state: auth } = useAuth()
  const signInOpen = useSignInModal()
  const showWriteFailure = useWriteFailure()
  const isSignedIn = computed(() => auth.value.status === 'authenticated')
  /** False until the list is read for the page: no "Add" is offered before. */
  const isListLoaded = computed(() => !isSignedIn.value || Boolean(source.loaded()))

  /** Changes shown but not yet saved, by work: laid over any list read meanwhile. */
  const unsaved = new Map<number, { isListed: boolean; writes: number }>()
  /** `read` with the unsaved changes laid over it. */
  const withUnsaved = (read: number[]) =>
    [...unsaved].reduce(
      (listed, [workId, { isListed }]) => withWork(listed, workId, isListed),
      new Set(read) as ReadonlySet<number>,
    )

  const listed = ref<ReadonlySet<number>>(new Set())
  watch(
    () => source.loaded(),
    (loaded) => (listed.value = withUnsaved(loaded ?? [])),
    { immediate: true },
  )

  /** Reads the list again, after a failed write. */
  async function resync() {
    const read = await fetchListedWorkIds(api, source.workIds())
    if (read) listed.value = withUnsaved(read)
  }
  const { run } = useOptimisticWrite({ resync })

  /** Shows the work as added or removed at once, and sends it; `announce` shows once saved. */
  function write(
    workId: number,
    isListed: boolean,
    send: () => Promise<unknown>,
    announce?: { messageKey: string; undo?: () => void },
  ) {
    return run({
      announce,
      apply: () => {
        unsaved.set(workId, { isListed, writes: (unsaved.get(workId)?.writes ?? 0) + 1 })
        listed.value = withWork(listed.value, workId, isListed)
      },
      send: async () => {
        try {
          return await send()
        } finally {
          const entry = unsaved.get(workId)
          if (entry && entry.writes > 1) unsaved.set(workId, { ...entry, writes: entry.writes - 1 })
          else unsaved.delete(workId)
        }
      },
    })
  }

  /** Adds the work with the default status; once saved, a toast confirms it, with an "Undo". */
  function addToList(workId: number) {
    return write(
      workId,
      true,
      () =>
        api.request(`/works/${workId}/entry`, {
          method: 'PUT',
          body: { status: DEFAULT_LIBRARY_STATUS },
        }),
      { messageKey: 'toast.entryAdded', undo: () => void removeFromList(workId) },
    )
  }

  /** Takes the work out of the list (only to undo an addition: the entry has no progress yet). */
  function removeFromList(workId: number) {
    return write(workId, false, () => api.request(`/works/${workId}/entry`, { method: 'DELETE' }))
  }

  /** Adds the work; a visitor signs in first and finds the work added after. */
  function add(workId: number) {
    if (isSignedIn.value) return addToList(workId)
    rememberPendingAdd(workId)
    signInOpen.value = true
  }

  // A window closed without signing in cancels the choice: a later sign-in elsewhere must not add it.
  watch(signInOpen, (isOpen) => {
    if (!isOpen && !isSignedIn.value) takePendingAdd()
  })

  let hasReplayed = false
  /** Adds the work a visitor chose before signing in, if it is shown and not in the list yet. */
  function replayPendingAdd() {
    if (hasReplayed || !isSignedIn.value || !isListLoaded.value) return
    hasReplayed = true
    const workId = takePendingAdd()
    if (workId === null || !source.workIds().includes(workId) || listed.value.has(workId)) return
    void addToList(workId)
  }
  onMounted(replayPendingAdd)
  watch(isListLoaded, replayPendingAdd)

  /** Without the list a work already in it would be offered for adding: say so, with a retry. */
  function announceLoadFailure() {
    if (isSignedIn.value && source.loaded() === null) {
      showWriteFailure(new Error('list not read'), { retry: source.reload })
    }
  }
  // Already failed when the page mounts after server rendering, which a watch alone never sees.
  onMounted(announceLoadFailure)
  // A new array at each page: fires again when the retry fails too, which `loaded` (still `null`) would not.
  watch(source.workIds, announceLoadFailure)

  return { listed, isSignedIn, isListLoaded, add }
}
