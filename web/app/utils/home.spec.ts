import { describe, expect, it } from 'vitest'
import {
  circularIndex,
  formatRatingAverage,
  pickExploreCodes,
  pickExploreFacets,
  incrementUnit,
  swipeDirection,
  type GenreItem,
} from './home'

describe('incrementUnit', () => {
  it('compte les tomes pour un lecteur qui ne suit que les tomes', () => {
    expect(incrementUnit({ chaptersRead: 0, volumesRead: 2 })).toBe('volumes')
  })

  it.each([
    { chaptersRead: 12, volumesRead: 0 },
    { chaptersRead: 5, volumesRead: 1 },
    { chaptersRead: 0, volumesRead: 0 },
  ])('compte les chapitres sinon (%o)', (entry) => {
    expect(incrementUnit(entry)).toBe('chapters')
  })
})

describe('pickExploreFacets', () => {
  it("range formats et genres dans l'ordre éditorial, compteurs conservés", () => {
    const result = pickExploreFacets({
      format: [
        { code: 'bd', count: 4 },
        { code: 'manga', count: 9 },
      ],
      genre: [
        { code: 'humor', count: 2 },
        { code: 'zen', count: 1 },
        { code: 'fantasy', count: 5 },
      ],
    })

    expect(result.formats).toEqual([
      { code: 'manga', count: 9 },
      { code: 'bd', count: 4 },
    ])
    expect(result.themes.map((item) => item.code)).toEqual(['fantasy', 'humor', 'zen'])
    expect(result.themes[0]).toEqual({ code: 'fantasy', count: 5 })
  })

  it('accepte des listes vides', () => {
    expect(pickExploreFacets({ format: [], genre: [] })).toEqual({ formats: [], themes: [] })
  })
})

describe('pickExploreCodes', () => {
  const format = (code: string): GenreItem => ({ code, category: 'format' })
  const theme = (code: string): GenreItem => ({ code, category: 'theme' })

  it('sépare les formats et les genres', () => {
    const items = [format('bd'), theme('humor'), format('manga'), theme('fantasy')]

    expect(pickExploreCodes(items)).toEqual({
      formats: ['manga', 'bd'],
      themes: ['fantasy', 'humor'],
    })
  })

  it('suit l’ordre éditorial, puis l’ordre alphabétique pour les codes inconnus', () => {
    const items = [
      format('webcomic'),
      format('zine'),
      format('bd'),
      format('autre'),
      format('manga'),
      theme('drama'),
      theme('fantasy'),
    ]

    expect(pickExploreCodes(items)).toEqual({
      formats: ['manga', 'bd', 'webcomic', 'autre', 'zine'],
      themes: ['fantasy', 'drama'],
    })
  })

  it('limite à 7 formats et 5 genres', () => {
    const formats = Array.from({ length: 9 }, (_, i) => format(`format_${i}`))
    const themes = Array.from({ length: 8 }, (_, i) => theme(`theme_${i}`))

    const codes = pickExploreCodes([...formats, ...themes])

    expect(codes.formats).toHaveLength(7)
    expect(codes.themes).toHaveLength(5)
  })

  it('renvoie des listes vides sans genre', () => {
    expect(pickExploreCodes([])).toEqual({ formats: [], themes: [] })
  })
})

describe('formatRatingAverage', () => {
  it('garde toujours une décimale, avec la virgule du français', () => {
    expect(formatRatingAverage(9.1, 'fr')).toBe('9,1')
    expect(formatRatingAverage(8, 'fr')).toBe('8,0')
  })

  it('utilise le point en anglais', () => {
    expect(formatRatingAverage(9.1, 'en')).toBe('9.1')
  })
})

describe('swipeDirection', () => {
  it('va vers la suite quand le doigt glisse vers la gauche, vers le retour vers la droite', () => {
    expect(swipeDirection(-80, 5)).toBe(1)
    expect(swipeDirection(80, -5)).toBe(-1)
  })

  it('ignore un geste trop court', () => {
    expect(swipeDirection(-39, 0)).toBe(0)
    expect(swipeDirection(40, 0)).toBe(-1)
  })

  it('ignore un geste surtout vertical : c’est un défilement de la page', () => {
    expect(swipeDirection(-60, 60)).toBe(0)
    expect(swipeDirection(-90, 60)).toBe(1)
  })
})

describe('circularIndex', () => {
  it('avance et recule en rebouclant aux extrémités', () => {
    expect(circularIndex(0, 1, 3)).toBe(1)
    expect(circularIndex(2, 1, 3)).toBe(0)
    expect(circularIndex(0, -1, 3)).toBe(2)
    expect(circularIndex(1, -1, 3)).toBe(0)
  })
})
