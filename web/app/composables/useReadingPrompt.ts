/** Confirmation asked before progress changes the reading status or the counters. */
import {
  countersToTotals,
  keepsChangesOnDecline,
  readingPrompt,
  withPromptStatus,
  type KnownTotals,
  type LibraryEntry,
  type LibraryEntryChanges,
  type ReadingPrompt,
} from '~/utils/library'

/** What the caller does depending on the answer: save the changes or drop them. */
interface PromptHandlers {
  apply: (changes: LibraryEntryChanges) => void
  discard: () => void
}

/** A question currently open, with the context needed to answer it. */
interface AskedPrompt extends PromptHandlers {
  prompt: ReadingPrompt
  entry: LibraryEntry
  totals: KnownTotals
  changes: LibraryEntryChanges
}

/** Whether the question proposes finishing the work. */
const isFinishPrompt = (prompt: ReadingPrompt) =>
  prompt === 'finishChapters' || prompt === 'finishVolumes'

/**
 * Question asked before a change on the reading sheet or the list adjusts the status or counters:
 * - "Reading" (a plan-to-read, on-hold or dropped work advances): only the confirmation saves
 *   (counter and status); Cancel, the cross, Escape and a click outside drop the change.
 * - "Completed" (the known total is reached): the confirmation saves counter and status, "Keep"
 *   saves the counter alone (otherwise the total could not be entered), the cross, Escape and a
 *   click outside drop the change.
 * - Switching to "Completed" with counters below the known total: the confirmation sets them to
 *   it, "Keep my counters" saves the status alone, the cross and Escape drop the change.
 */
export function useReadingPrompt() {
  const { t } = useI18n()
  const isOpen = ref(false)
  const asked = ref<AskedPrompt | null>(null)
  let answer: 'confirmed' | 'declined' | null = null
  let isWaiting = false

  const askedPrompt = computed(() => asked.value?.prompt ?? 'start')
  const isFinish = computed(() => isFinishPrompt(askedPrompt.value))
  const isCompleteCounters = computed(() => askedPrompt.value === 'completeCounters')
  // Non-breaking spaces: the 'reading' status label never splits across two lines of a button.
  const statusLabel = computed(() =>
    t(`readingStatus.${asked.value?.entry.status ?? 'plan_to_read'}`).replaceAll(' ', ' '),
  )

  // The totals the confirmation would write (the question text fits on one line).
  const counterTargets = computed(() => {
    const current = asked.value
    return current ? countersToTotals(current.entry, current.changes, current.totals) : {}
  })

  const title = computed(() => {
    if (isCompleteCounters.value) return t('library.readingPrompt.completeCounters')
    return t(`library.readingPrompt.${isFinish.value ? 'finish' : askedPrompt.value}`)
  })
  const text = computed(() => {
    const totals = asked.value?.totals
    switch (askedPrompt.value) {
      // Plural: "the published volume" for one, "the 4 published volumes" otherwise.
      case 'finishChapters':
        return t(
          'library.readingPrompt.finishChapters',
          { total: totals?.chapters },
          totals?.chapters ?? 0,
        )
      case 'finishVolumes':
        return t(
          'library.readingPrompt.finishVolumes',
          { total: totals?.volumes },
          totals?.volumes ?? 0,
        )
      case 'completeCounters': {
        const { chaptersRead: chapters, volumesRead: volumes } = counterTargets.value
        if (chapters !== undefined && volumes !== undefined) {
          return t('library.readingPrompt.completeBoth', { chapters, volumes })
        }
        return chapters === undefined
          ? t('library.readingPrompt.completeVolumes', { total: volumes })
          : t('library.readingPrompt.completeChapters', { total: chapters })
      }
      default:
        return t('library.readingPrompt.text', { status: statusLabel.value })
    }
  })
  const confirmLabel = computed(() => {
    if (isCompleteCounters.value) return t('library.readingPrompt.confirmCounters')
    return t(`library.readingPrompt.${isFinish.value ? 'confirmFinish' : 'confirm'}`)
  })
  const cancelLabel = computed(() => {
    if (isCompleteCounters.value) return t('library.readingPrompt.keepCounters')
    return isFinish.value
      ? t('library.readingPrompt.keep', { status: statusLabel.value })
      : t('library.readingPrompt.cancel')
  })

  /** Opens the question if the change needs one; `false`: the caller applies it as is. */
  function request(
    entry: LibraryEntry,
    totals: KnownTotals,
    changes: LibraryEntryChanges,
    handlers: PromptHandlers,
  ): boolean {
    const prompt = readingPrompt(entry, changes, totals)
    if (prompt === null) return false
    asked.value = { ...handlers, prompt, entry, totals, changes }
    answer = null
    isWaiting = true
    isOpen.value = true
    return true
  }

  /** Records that the user confirmed the question. */
  const confirm = () => {
    answer = 'confirmed'
  }
  /** Records that the user declined the question. */
  const decline = () => {
    answer = 'declined'
  }

  // After closing (`post`: the button click has had time to record the answer).
  watch(
    isOpen,
    (open) => {
      const current = asked.value
      if (open || !isWaiting || !current) return
      isWaiting = false
      if (answer === 'confirmed') {
        current.apply(
          withPromptStatus(current.prompt, current.changes, current.entry, current.totals),
        )
      } else if (answer === 'declined' && keepsChangesOnDecline(current.prompt)) {
        current.apply(current.changes)
      } else current.discard()
    },
    { flush: 'post' },
  )

  return { isOpen, title, text, confirmLabel, cancelLabel, request, confirm, decline }
}
