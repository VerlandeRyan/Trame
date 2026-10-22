import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from './library'
import {
  applyEntryChangeToCounts,
  countEntriesOfAllStatuses,
  dragOffset,
  dragProgress,
  formatProgress,
  hasMorePages,
  isInTab,
  parseListQuery,
  toListApiQuery,
  toListRouteQuery,
  unitProgress,
  type ListedEntry,
  type ListState,
  type StatusCounts,
} from './reading-list'

const entry = (overrides: Partial<LibraryEntry> = {}): LibraryEntry => ({
  status: 'reading',
  chaptersRead: 12,
  volumesRead: 2,
  rating: null,
  startedOn: null,
  finishedOn: null,
  ...overrides,
})

const counts: StatusCounts = { reading: 3, completed: 2, plan_to_read: 4, on_hold: 0, dropped: 1 }

function listed(entryOverrides: Partial<LibraryEntry>, chapters: number | null): ListedEntry {
  return {
    entry: entry(entryOverrides),
    work: {
      id: 1,
      title: 'A',
      originalTitle: 'A',
      originalLanguage: 'fr',
      type: 'series',
      status: 'ongoing',
      formats: ['manga'],
      coverPath: null,
      mainAuthor: null,
      chapters,
      volumes: 3,
    },
  }
}

describe('parseListQuery', () => {
  it('prend les valeurs par défaut', () => {
    expect(parseListQuery({})).toEqual({ status: null, q: '', sort: 'updated', view: 'list' })
  })

  it('lit l’onglet, la recherche, le tri et la vue', () => {
    expect(
      parseListQuery({ status: 'on_hold', q: '  aube   manga ', sort: 'rating', view: 'grid' }),
    ).toEqual({ status: 'on_hold', q: 'aube manga', sort: 'rating', view: 'grid' })
  })

  it('ignore les valeurs inconnues et ne garde que la première d’une liste', () => {
    expect(parseListQuery({ status: 'finished', sort: 'rank', view: 'table' })).toMatchObject({
      status: null,
      sort: 'updated',
      view: 'list',
    })
    expect(parseListQuery({ status: ['dropped', 'reading'] }).status).toBe('dropped')
    expect(parseListQuery({ q: 42 }).q).toBe('')
  })

  it('limite la recherche à 100 caractères', () => {
    expect(parseListQuery({ q: 'a'.repeat(150) }).q).toHaveLength(100)
  })
})

describe('toListRouteQuery', () => {
  it('omet les valeurs par défaut', () => {
    expect(toListRouteQuery({ status: null, q: '', sort: 'updated', view: 'list' })).toEqual({})
  })

  it('garde ce qui diffère', () => {
    const state: ListState = { status: 'reading', q: 'aube', sort: 'title', view: 'grid' }
    expect(toListRouteQuery(state)).toEqual({
      status: 'reading',
      q: 'aube',
      sort: 'title',
      view: 'grid',
    })
  })
})

describe('toListApiQuery', () => {
  const base: ListState = { status: null, q: '', sort: 'updated', view: 'list' }

  it('envoie la langue, le tri et la page', () => {
    expect(toListApiQuery(base, { lang: 'fr', page: 2 })).toEqual({
      lang: 'fr',
      sort: 'updated',
      page: 2,
      pageSize: 50,
    })
  })

  it('ajoute le statut et la recherche d’au moins 2 caractères', () => {
    expect(
      toListApiQuery({ ...base, status: 'dropped', q: 'ab' }, { lang: 'en', page: 1 }),
    ).toMatchObject({ status: 'dropped', q: 'ab' })
  })

  it('n’envoie pas une recherche d’un seul caractère', () => {
    expect(toListApiQuery({ ...base, q: 'a' }, { lang: 'fr', page: 1 })).not.toHaveProperty('q')
  })
})

describe('compteurs', () => {
  it('additionne les statuts pour « Tous »', () => {
    expect(countEntriesOfAllStatuses(counts)).toBe(10)
  })

  it('sait s’il reste des pages', () => {
    expect(hasMorePages(50, 53)).toBe(true)
    expect(hasMorePages(53, 53)).toBe(false)
  })

  it('reconnaît l’onglet d’une entrée', () => {
    expect(isInTab(entry(), null)).toBe(true)
    expect(isInTab(entry(), 'reading')).toBe(true)
    expect(isInTab(entry(), 'dropped')).toBe(false)
  })
})

describe('applyEntryChangeToCounts', () => {
  const summary = { statusCounts: counts, totals: { chaptersRead: 100, volumesRead: 10 } }

  it('déplace l’œuvre d’un statut à l’autre et ajuste les deux totaux séparément', () => {
    const result = applyEntryChangeToCounts(
      summary,
      entry({ chaptersRead: 12, volumesRead: 2 }),
      entry({ status: 'completed', chaptersRead: 13, volumesRead: 2 }),
    )
    expect(result.statusCounts).toMatchObject({ reading: 2, completed: 3 })
    expect(result.totals).toEqual({ chaptersRead: 101, volumesRead: 10 })
  })

  it('retire l’œuvre et ce qu’elle comptait', () => {
    const result = applyEntryChangeToCounts(
      summary,
      entry({ chaptersRead: 12, volumesRead: 2 }),
      null,
    )
    expect(result.statusCounts.reading).toBe(2)
    expect(result.totals).toEqual({ chaptersRead: 88, volumesRead: 8 })
  })

  it('ne modifie pas les compteurs reçus', () => {
    applyEntryChangeToCounts(summary, entry(), null)
    expect(summary.statusCounts.reading).toBe(3)
  })
})

describe('progression par compteur', () => {
  it('lit les chapitres et les tomes séparément', () => {
    const item = listed({ chaptersRead: 12, volumesRead: 2 }, 86)
    expect(unitProgress(item, 'chapters')).toEqual({ read: 12, total: 86 })
    expect(unitProgress(item, 'volumes')).toEqual({ read: 2, total: 3 })
  })

  it('formate « lu » ou « lu/total »', () => {
    expect(formatProgress({ read: 12, total: null })).toBe('12')
    expect(formatProgress({ read: 86, total: 86 })).toBe('86/86')
  })
})

describe('dragOffset', () => {
  it('suit le doigt, amorti et borné', () => {
    expect(dragOffset(-50, 0)).toBe(-40)
    expect(dragOffset(50, 0)).toBe(40)
    expect(dragOffset(500, 0)).toBe(84)
    expect(dragOffset(-500, 0)).toBe(-84)
  })

  it('ne bouge pas pour un geste court ou plutôt vertical', () => {
    expect(dragOffset(5, 0)).toBe(0)
    expect(dragOffset(60, 80)).toBe(0)
  })
})

describe('dragProgress', () => {
  it('va de 0 à 1 puis reste à 1', () => {
    expect(dragProgress(0)).toBe(0)
    expect(dragProgress(16)).toBeCloseTo(0.5)
    expect(dragProgress(-32)).toBe(1)
    expect(dragProgress(84)).toBe(1)
  })
})
