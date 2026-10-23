import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from './library'
import { monogram, statusShares, updateAge, updateProgress } from './profile'

const NOW = new Date(2026, 9, 23, 15, 0)

describe('monogram', () => {
  it('prend les deux premières lettres en majuscules', () => {
    expect(monogram('handle')).toBe('HA')
  })
})

describe('statusShares', () => {
  it('ne montre aucune part pour une liste vide', () => {
    expect(
      statusShares({ reading: 0, completed: 0, plan_to_read: 0, on_hold: 0, dropped: 0 }),
    ).toEqual([])
  })

  it('omet les statuts à zéro et calcule les parts dans l’ordre des statuts', () => {
    const shares = statusShares({
      reading: 1,
      completed: 3,
      plan_to_read: 0,
      on_hold: 0,
      dropped: 0,
    })
    expect(shares).toEqual([
      { status: 'reading', count: 1, percent: 25 },
      { status: 'completed', count: 3, percent: 75 },
    ])
  })

  it('place « À lire » avant « Terminé », comme la légende de la maquette', () => {
    const shares = statusShares({
      reading: 0,
      completed: 1,
      plan_to_read: 1,
      on_hold: 0,
      dropped: 0,
    })

    expect(shares.map((share) => share.status)).toEqual(['plan_to_read', 'completed'])
  })
})

describe('updateProgress', () => {
  const entry = (changes: Partial<LibraryEntry>): LibraryEntry => ({
    status: 'reading',
    chaptersRead: 0,
    volumesRead: 0,
    rating: null,
    startedOn: null,
    finishedOn: null,
    ...changes,
  })

  it('donne la note d’une œuvre terminée, ou aucune', () => {
    expect(updateProgress(entry({ status: 'completed', rating: 8 }))).toEqual({
      kind: 'completed',
      rating: 8,
    })
    expect(updateProgress(entry({ status: 'completed' }))).toEqual({
      kind: 'completed',
      rating: null,
    })
  })

  it('compte les tomes d’un lecteur qui ne suit que les tomes', () => {
    expect(updateProgress(entry({ volumesRead: 3 }))).toEqual({ kind: 'volume', value: 3 })
  })

  it('compte les chapitres dès qu’il y en a, même avec des tomes', () => {
    expect(updateProgress(entry({ chaptersRead: 40, volumesRead: 1 }))).toEqual({
      kind: 'chapter',
      value: 40,
    })
  })
})

describe('updateAge', () => {
  const daysAgo = (days: number) => new Date(2026, 9, 23 - days, 8, 0).toISOString()

  it.each([
    [0, { unit: 'today' }],
    [1, { unit: 'yesterday' }],
    [5, { unit: 'days', count: 5 }],
    [21, { unit: 'weeks', count: 3 }],
    [90, { unit: 'months', count: 3 }],
  ])('%i jour(s) en arrière', (days, expected) => {
    expect(updateAge(daysAgo(days), NOW)).toEqual(expected)
  })
})
