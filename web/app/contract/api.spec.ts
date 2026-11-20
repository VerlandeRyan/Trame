import { describe, expect, it } from 'vitest'
import { ERROR_CODES, LIBRARY_STATUSES, LIST_SORTS, SEARCH_SORTS } from './api'

describe('valeurs du contrat lues par le front', () => {
  it('expose les tris de la recherche et de la liste de lecture', () => {
    expect(SEARCH_SORTS).toEqual(['relevance', 'title', 'recent'])
    expect(LIST_SORTS).toEqual(['updated', 'title', 'rating'])
  })

  it('expose les codes d’erreur que le front traduit', () => {
    for (const code of ['INTERNAL_ERROR', 'RATE_LIMITED', 'NOT_FOUND', 'VALIDATION_ERROR']) {
      expect(ERROR_CODES).toContain(code)
    }
  })

  it('expose les statuts de lecture', () => {
    expect(LIBRARY_STATUSES).toContain('plan_to_read')
  })
})
