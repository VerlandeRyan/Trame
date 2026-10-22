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

/** Ce que fait l'appelant selon la réponse : enregistrer les changements ou les abandonner. */
interface PromptHandlers {
  apply: (changes: LibraryEntryChanges) => void
  discard: () => void
}

interface AskedPrompt extends PromptHandlers {
  prompt: ReadingPrompt
  entry: LibraryEntry
  totals: KnownTotals
  changes: LibraryEntryChanges
}

const isFinishPrompt = (prompt: ReadingPrompt) =>
  prompt === 'finishChapters' || prompt === 'finishVolumes'

/**
 * Question posée avant qu'un changement de la fiche de lecture ou de la liste ajuste le statut
 * ou les compteurs :
 * - « En cours » (une œuvre « À lire », « En pause » ou « Abandonné » avance) : seule la
 *   confirmation enregistre (compteur et statut) ; Annuler, la croix, Échap et un clic à côté
 *   abandonnent le changement.
 * - « Terminé » (le total connu est atteint) : la confirmation enregistre compteur et statut,
 *   « Garder » enregistre le compteur seul (sinon on ne pourrait pas saisir le total), la croix,
 *   Échap et un clic à côté abandonnent le changement.
 * - Passage en « Terminé » avec des compteurs sous le total connu : la confirmation les y met,
 *   « Garder mes compteurs » enregistre le statut seul, la croix et Échap abandonnent.
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
  // Insécables : « En cours » ne se coupe jamais entre deux lignes d'un bouton.
  const statusLabel = computed(() =>
    t(`readingStatus.${asked.value?.entry.status ?? 'plan_to_read'}`).replaceAll(' ', ' '),
  )

  // Les totaux que la confirmation écrirait (le texte de la question tient sur une ligne).
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
      // Pluriel : « le tome paru » pour un seul, « les 4 tomes parus » sinon.
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

  /** Ouvre la question si le changement en demande une ; `false` : l'appelant l'applique tel quel. */
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

  const confirm = () => {
    answer = 'confirmed'
  }
  const decline = () => {
    answer = 'declined'
  }

  // Après la fermeture (`post` : le clic sur un bouton a eu le temps de noter la réponse).
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
