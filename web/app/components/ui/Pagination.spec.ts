import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiPagination from './Pagination.vue'

const linkFor = (page: number) => ({ path: '/search', query: { q: 'tit', page: String(page) } })

describe('UiPagination', () => {
  it("n'affiche rien avec une seule page", async () => {
    const wrapper = await mountSuspended(UiPagination, { props: { page: 1, pages: 1, linkFor } })

    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('marque la page courante et abrège la série avec des points de suspension', async () => {
    const wrapper = await mountSuspended(UiPagination, { props: { page: 5, pages: 9, linkFor } })

    expect(wrapper.get('[aria-current="page"]').text()).toBe('5')
    expect(wrapper.findAll('a').map((link) => link.attributes('aria-label') ?? '')).toEqual(
      expect.arrayContaining(['Page 1', 'Page 4', 'Page 6', 'Page 9']),
    )
    expect(wrapper.text()).toContain('…')
    expect(wrapper.get('[data-testid="pagination-previous"]').attributes('href')).toBe(
      '/search?q=tit&page=4',
    )
    expect(wrapper.get('[data-testid="pagination-next"]').attributes('href')).toBe(
      '/search?q=tit&page=6',
    )
  })

  it('désactive « Précédent » sur la première page et « Suivant » sur la dernière', async () => {
    const first = await mountSuspended(UiPagination, { props: { page: 1, pages: 3, linkFor } })
    expect(first.find('[data-testid="pagination-previous"]').exists()).toBe(false)
    expect(first.find('[data-testid="pagination-next"]').exists()).toBe(true)

    const last = await mountSuspended(UiPagination, { props: { page: 3, pages: 3, linkFor } })
    expect(last.find('[data-testid="pagination-next"]').exists()).toBe(false)
  })
})
