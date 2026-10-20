import { describe, expect, it } from 'vitest'
import {
  exceedsKnownTotal,
  libraryErrorKey,
  readingPrompt,
  withPromptStatus,
  type LibraryEntry,
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

describe('withPromptStatus', () => {
  it('ajoute « En cours » pour commencer ou reprendre', () => {
    expect(withPromptStatus('start', { chaptersRead: 1 })).toEqual({
      chaptersRead: 1,
      status: 'reading',
    })
    expect(withPromptStatus('resume', { volumesRead: 1 }).status).toBe('reading')
  })

  it('ajoute « Terminé » quand le total est atteint', () => {
    expect(withPromptStatus('finishChapters', { chaptersRead: 158 }).status).toBe('completed')
    expect(withPromptStatus('finishVolumes', { volumesRead: 4 }).status).toBe('completed')
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
