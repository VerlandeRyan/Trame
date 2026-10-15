import { describe, expect, it } from 'vitest'
import { shouldScrollToTop } from './scroll'

const route = (path: string, query: Record<string, unknown> = {}) => ({ path, query })

describe('shouldScrollToTop', () => {
  it('remonte quand on change de page', () => {
    expect(shouldScrollToTop(route('/work/1-aube'), route('/search'))).toBe(true)
  })

  it('remonte quand la recherche ou la page de résultats change', () => {
    expect(shouldScrollToTop(route('/search', { q: 'ri' }), route('/search'))).toBe(true)
    expect(shouldScrollToTop(route('/search', { q: 'ri' }), route('/search', { q: 'ab' }))).toBe(
      true,
    )
    expect(shouldScrollToTop(route('/search', { page: '2' }), route('/search'))).toBe(true)
  })

  it('garde la position quand seuls un filtre ou le tri changent', () => {
    expect(
      shouldScrollToTop(
        route('/search', { q: 'ri', type: 'series' }),
        route('/search', { q: 'ri' }),
      ),
    ).toBe(false)
    expect(
      shouldScrollToTop(
        route('/search', { q: 'ri', sort: 'title' }),
        route('/search', { q: 'ri' }),
      ),
    ).toBe(false)
  })
})
