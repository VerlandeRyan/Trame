import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SearchFilterGroup from './FilterGroup.vue'

const genres = [
  { code: 'fantasy', count: 12 },
  { code: 'humor', count: 8 },
  { code: 'science_fiction', count: 6 },
  { code: 'manga', count: 5 },
  { code: 'bd', count: 4 },
  { code: 'webtoon', count: 3 },
  { code: 'comics', count: 2 },
]

describe('SearchFilterGroup', () => {
  it('affiche libellés et compteurs, et le titre du groupe', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'type', facets: [{ code: 'series', count: 28 }], open: true },
    })

    expect(wrapper.get('h3').text()).toBe('Type')
    expect(wrapper.get('li').text()).toBe('Série28')
  })

  it("n'affiche rien sans valeur ni sélection", async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'status', facets: [], open: true },
    })

    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('coche plusieurs valeurs du groupe et compte les choix dans la pastille', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: {
        filterKey: 'status',
        facets: [
          { code: 'ongoing', count: 7 },
          { code: 'hiatus', count: 1 },
          { code: 'completed', count: 4 },
        ],
        selected: ['ongoing', 'hiatus'],
        open: true,
      },
    })

    const checked = (code: string) =>
      (wrapper.get(`[data-testid="filter-status-${code}"]`).element as HTMLInputElement).checked
    expect([checked('ongoing'), checked('hiatus'), checked('completed')]).toEqual([
      true,
      true,
      false,
    ])
    expect(wrapper.get('[data-testid="filter-badge"]').text()).toBe('2')
  })

  it('émet la valeur cliquée et coche la valeur choisie', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: {
        filterKey: 'type',
        facets: [
          { code: 'series', count: 2 },
          { code: 'oneshot', count: 1 },
        ],
        selected: ['series'],
        open: true,
      },
    })

    expect(
      (wrapper.get('[data-testid="filter-type-series"]').element as HTMLInputElement).checked,
    ).toBe(true)
    await wrapper.get('[data-testid="filter-type-oneshot"]').trigger('change')
    expect(wrapper.emitted('toggle')).toEqual([['oneshot']])
  })

  it('affiche le nombre de choix dans une pastille quand une valeur est choisie', async () => {
    const facets = [{ code: 'series', count: 2 }]
    const without = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'type', facets, open: true },
    })
    expect(without.find('[data-testid="filter-badge"]').exists()).toBe(false)

    const chosen = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'type', facets, selected: ['series'], open: true },
    })
    const badge = chosen.get('[data-testid="filter-badge"]')
    expect(badge.text()).toBe('1')
    expect(badge.attributes('aria-label')).toBe('1 choix')
  })

  it('met le chevron avant le titre et demande l’ouverture ou la fermeture', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'type', facets: [{ code: 'series', count: 2 }], open: true },
    })

    const title = wrapper.get('button.filter-group__title')
    expect(title.element.firstElementChild?.classList.contains('filter-group__chevron')).toBe(true)
    expect(title.attributes('aria-expanded')).toBe('true')

    await title.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('masque la liste quand le groupe est replié', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'type', facets: [{ code: 'series', count: 2 }], open: false },
    })

    expect(wrapper.get('button.filter-group__title').attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.filter-group__panel').attributes('style')).toContain('display: none')
    expect(wrapper.get('.filter-group__chevron').classes()).toContain(
      'filter-group__chevron--closed',
    )
  })

  it('garde la valeur choisie même sans résultat', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'type', facets: [], selected: ['oneshot'], open: true },
    })

    expect(wrapper.get('li').text()).toBe('One-shot0')
  })

  it('replie au-delà de la limite puis déplie « Voir les N autres »', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'genre', facets: genres, limit: 5, open: true },
    })

    expect(wrapper.findAll('li')).toHaveLength(5)
    const more = wrapper.get('.filter-group__more')
    expect(more.text()).toBe('Voir les 2 autres')
    await more.trigger('click')
    expect(wrapper.findAll('li')).toHaveLength(7)
    expect(wrapper.get('.filter-group__more').text()).toBe('Voir moins')
  })

  it('montre la valeur choisie même au-delà de la limite', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'genre', facets: genres, limit: 2, selected: ['comics'], open: true },
    })

    expect(wrapper.findAll('li').map((item) => item.text())).toContain('Comics2')
  })

  it('filtre les valeurs sans tenir compte des accents ni de la casse', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: { filterKey: 'genre', facets: genres, searchable: true, limit: 2, open: true },
    })

    await wrapper.get('input[type="search"]').setValue('SCIENCE')
    expect(wrapper.findAll('li').map((item) => item.text())).toEqual(['Science-fiction6'])
  })

  it('met en majuscules un code de langue sans traduction', async () => {
    const wrapper = await mountSuspended(SearchFilterGroup, {
      props: {
        filterKey: 'originalLanguage',
        facets: [
          { code: 'ja', count: 3 },
          { code: 'xx', count: 1 },
        ],
        open: true,
      },
    })

    expect(wrapper.findAll('li').map((item) => item.text())).toEqual(['Japonais3', 'XX1'])
  })
})
