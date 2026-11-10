import { describe, expect, it } from 'vitest'
import {
  countersToTotals,
  exceedsKnownTotal,
  keepsChangesOnDecline,
  libraryErrorKey,
  readingPrompt,
  withPromptStatus,
  type LibraryEntry,
  type LibraryEntryChanges,
} from './library'

const TO_READ: LibraryEntry = {
  status: 'plan_to_read',
  chaptersRead: 0,
  volumesRead: 0,
  rating: null,
  startedOn: null,
  finishedOn: null,
}

describe('readingPrompt', () => {
  const NO_TOTALS = { chapters: null, volumes: null }
  const READING: LibraryEntry = { ...TO_READ, status: 'reading', chaptersRead: 150, volumesRead: 2 }

  it('demande de commencer une œuvre « À lire » dès un chapitre ou un tome de plus', () => {
    expect(readingPrompt(TO_READ, { chaptersRead: 1 }, NO_TOTALS)).toBe('start')
    expect(readingPrompt(TO_READ, { volumesRead: 1 }, NO_TOTALS)).toBe('start')
  })

  it('demande de reprendre une œuvre « En pause » ou « Abandonné »', () => {
    const paused = { ...TO_READ, status: 'on_hold' as const }
    const dropped = { ...TO_READ, status: 'dropped' as const }
    expect(readingPrompt(paused, { chaptersRead: 1 }, NO_TOTALS)).toBe('resume')
    expect(readingPrompt(dropped, { volumesRead: 1 }, NO_TOTALS)).toBe('resume')
  })

  it('ne demande rien pour un retrait, une note, une date ou un autre statut', () => {
    const progressed = { ...TO_READ, chaptersRead: 3 }
    expect(readingPrompt(progressed, { chaptersRead: 2 }, NO_TOTALS)).toBeNull()
    expect(readingPrompt(TO_READ, { rating: 8 }, NO_TOTALS)).toBeNull()
    expect(readingPrompt(TO_READ, { startedOn: '2026-01-01' }, NO_TOTALS)).toBeNull()
    expect(readingPrompt(READING, { chaptersRead: 151 }, NO_TOTALS)).toBeNull()
    expect(
      readingPrompt({ ...TO_READ, status: 'completed' }, { chaptersRead: 1 }, NO_TOTALS),
    ).toBeNull()
  })

  it('ne demande rien quand le changement fixe déjà un statut', () => {
    expect(readingPrompt(TO_READ, { chaptersRead: 1, status: 'dropped' }, NO_TOTALS)).toBeNull()
  })

  describe('total connu atteint', () => {
    const TOTALS = { chapters: 158, volumes: 4 }

    it('propose « Terminé » en atteignant ou en dépassant le total de chapitres ou de tomes', () => {
      expect(readingPrompt(READING, { chaptersRead: 158 }, TOTALS)).toBe('finishChapters')
      expect(readingPrompt(READING, { chaptersRead: 200 }, TOTALS)).toBe('finishChapters')
      expect(readingPrompt(READING, { volumesRead: 4 }, TOTALS)).toBe('finishVolumes')
    })

    it('passe avant « En cours » pour une œuvre pas encore commencée', () => {
      expect(readingPrompt(TO_READ, { chaptersRead: 158 }, TOTALS)).toBe('finishChapters')
      expect(readingPrompt({ ...TO_READ, status: 'dropped' }, { volumesRead: 4 }, TOTALS)).toBe(
        'finishVolumes',
      )
    })

    it('ne propose rien tant que le total n’est pas atteint, ni quand il est inconnu', () => {
      expect(readingPrompt(READING, { chaptersRead: 157 }, TOTALS)).toBeNull()
      expect(readingPrompt(READING, { chaptersRead: 5000 }, NO_TOTALS)).toBeNull()
    })

    it('ne repropose pas quand le total était déjà atteint ou que l’œuvre est terminée', () => {
      const atTotal = { ...READING, chaptersRead: 158 }
      expect(readingPrompt(atTotal, { chaptersRead: 159 }, TOTALS)).toBeNull()
      expect(
        readingPrompt({ ...READING, status: 'completed' }, { chaptersRead: 158 }, TOTALS),
      ).toBeNull()
    })
  })
})

describe('passage en « Terminé »', () => {
  const TOTALS = { chapters: 158, volumes: 4 }
  const READING: LibraryEntry = { ...TO_READ, status: 'reading', chaptersRead: 12, volumesRead: 1 }

  it('propose de mettre les compteurs aux totaux connus quand ils sont en dessous', () => {
    expect(readingPrompt(READING, { status: 'completed' }, TOTALS)).toBe('completeCounters')
    expect(readingPrompt(TO_READ, { status: 'completed' }, { chapters: 158, volumes: null })).toBe(
      'completeCounters',
    )
  })

  it('ne propose rien sans total connu, compteurs déjà au total, ou œuvre déjà terminée', () => {
    expect(
      readingPrompt(READING, { status: 'completed' }, { chapters: null, volumes: null }),
    ).toBeNull()
    const atTotals = { ...READING, chaptersRead: 158, volumesRead: 4 }
    expect(readingPrompt(atTotals, { status: 'completed' }, TOTALS)).toBeNull()
    const completed = { ...READING, status: 'completed' as const }
    expect(readingPrompt(completed, { status: 'completed' }, TOTALS)).toBeNull()
  })

  it('ne propose rien pour un autre statut', () => {
    expect(readingPrompt(READING, { status: 'dropped' }, TOTALS)).toBeNull()
  })

  it('tient compte des compteurs saisis dans les mêmes changements', () => {
    const changes = { status: 'completed' as const, chaptersRead: 158, volumesRead: 4 }
    expect(readingPrompt(READING, changes, TOTALS)).toBeNull()
    expect(countersToTotals(READING, { ...changes, volumesRead: 2 }, TOTALS)).toEqual({
      volumesRead: 4,
    })
  })
})

describe('withPromptStatus', () => {
  const NO_TOTALS = { chapters: null, volumes: null }

  it('ajoute « En cours » pour commencer ou reprendre', () => {
    expect(withPromptStatus('start', { chaptersRead: 1 }, TO_READ, NO_TOTALS)).toEqual({
      chaptersRead: 1,
      status: 'reading',
    })
    expect(withPromptStatus('resume', { volumesRead: 1 }, TO_READ, NO_TOTALS).status).toBe(
      'reading',
    )
  })

  it('ajoute « Terminé » quand le total est atteint', () => {
    const finish = (prompt: 'finishChapters' | 'finishVolumes', changes: LibraryEntryChanges) =>
      withPromptStatus(prompt, changes, TO_READ, NO_TOTALS).status
    expect(finish('finishChapters', { chaptersRead: 158 })).toBe('completed')
    expect(finish('finishVolumes', { volumesRead: 4 })).toBe('completed')
  })

  it('met seulement les compteurs en dessous aux totaux pour « Terminé »', () => {
    const entry: LibraryEntry = { ...TO_READ, status: 'reading', chaptersRead: 12, volumesRead: 4 }
    expect(
      withPromptStatus('completeCounters', { status: 'completed' }, entry, {
        chapters: 158,
        volumes: 4,
      }),
    ).toEqual({ status: 'completed', chaptersRead: 158 })
  })
})

describe('keepsChangesOnDecline', () => {
  it('garde les changements sur les questions de fin, pas sur celles de début', () => {
    expect(keepsChangesOnDecline('finishChapters')).toBe(true)
    expect(keepsChangesOnDecline('completeCounters')).toBe(true)
    expect(keepsChangesOnDecline('start')).toBe(false)
    expect(keepsChangesOnDecline('resume')).toBe(false)
  })
})

describe('exceedsKnownTotal', () => {
  it('avertit seulement au-delà du total connu', () => {
    expect(exceedsKnownTotal(121, 120)).toBe(true)
    expect(exceedsKnownTotal(120, 120)).toBe(false)
  })

  it("n'avertit jamais quand le total est inconnu", () => {
    expect(exceedsKnownTotal(5000, null)).toBe(false)
  })
})

describe('libraryErrorKey', () => {
  it('traduit les codes connus et se replie sur un message générique', () => {
    expect(libraryErrorKey('UNAUTHENTICATED')).toBe('library.error.signedOut')
    expect(libraryErrorKey('NOT_FOUND')).toBe('library.error.notFound')
    expect(libraryErrorKey('RATE_LIMITED')).toBe('error.RATE_LIMITED')
    expect(libraryErrorKey('INTERNAL_ERROR')).toBe('library.error.generic')
    expect(libraryErrorKey('constructor')).toBe('library.error.generic')
  })
})
