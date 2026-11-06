import { describe, expect, it } from 'vitest'
import { counterKey } from './units'

describe('counterKey', () => {
  it('donne la clé de chaque forme pour les chapitres', () => {
    expect(counterKey('chapters', 'label')).toBe('counter.chapters.label')
    expect(counterKey('chapters', 'unit')).toBe('counter.chapters.unit')
    expect(counterKey('chapters', 'compact')).toBe('counter.chapters.compact')
    expect(counterKey('chapters', 'position')).toBe('counter.chapters.position')
  })

  it('donne la clé de chaque forme pour les tomes', () => {
    expect(counterKey('volumes', 'label')).toBe('counter.volumes.label')
    expect(counterKey('volumes', 'compact')).toBe('counter.volumes.compact')
  })
})
