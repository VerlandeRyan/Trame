import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { AdminKind, AdminState, AdminWorkFilters } from '~/utils/admin'
import AdminFilters from './Filters.vue'

const NO_FILTERS: AdminWorkFilters = { type: [], status: [], format: [] }

const mountFilters = (
  filters: AdminWorkFilters = NO_FILTERS,
  extra: { kind?: AdminKind; state?: AdminState } = {},
) =>
  mountSuspended(AdminFilters, {
    props: {
      kind: 'works',
      filters,
      state: 'all',
      sort: 'title',
      formats: ['manga', 'webtoon'],
      total: 12,
      ...extra,
    },
  })

type Wrapper = Awaited<ReturnType<typeof mountFilters>>

async function choose(wrapper: Wrapper, testId: string, label: string) {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  const option = wrapper.findAll('[role="option"]').find((item) => item.text().includes(label))
  await option!.trigger('click')
}

describe('AdminFilters', () => {
  it('propose type, format, statut et tri, sans champ auteur', async () => {
    const wrapper = await mountFilters()

    for (const testId of ['filter-type', 'filter-format', 'filter-status', 'filter-sort']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="filter-author"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="filter-reset"]').exists()).toBe(false)
  })

  it('ajoute une valeur au filtre sans toucher aux autres', async () => {
    const wrapper = await mountFilters({ ...NO_FILTERS, status: ['ongoing'], type: ['series'] })

    await wrapper.get('[data-testid="filter-type-oneshot"]').setValue(true)

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { type: ['series', 'oneshot'], status: ['ongoing'], format: [] },
    ])
  })

  it('retire une valeur décochée', async () => {
    const wrapper = await mountFilters({ ...NO_FILTERS, format: ['manga', 'webtoon'] })

    await wrapper.get('[data-testid="filter-format-manga"]').setValue(false)

    expect(wrapper.emitted('change')?.[0]).toEqual([{ ...NO_FILTERS, format: ['webtoon'] }])
  })

  it('émet le tri choisi', async () => {
    const wrapper = await mountFilters()

    await choose(wrapper, 'filter-sort', 'Moins complètes')

    expect(wrapper.emitted('sort')?.[0]).toEqual(['completeness'])
  })

  it('compte les filtres actifs sur le bouton de la feuille mobile', async () => {
    const none = await mountFilters()
    const some = await mountFilters({ ...NO_FILTERS, type: ['series'], format: ['manga'] })

    expect(none.get('[data-testid="filters-open"]').text()).toBe('Filtres')
    expect(some.get('[data-testid="filters-open"]').text()).toBe('Filtres (2)')
  })

  it('choisit les mêmes filtres en cases à cocher dans la feuille', async () => {
    const wrapper = await mountFilters({ ...NO_FILTERS, type: ['series'] })

    await wrapper.get('[data-testid="filters-open"]').trigger('click')
    await wrapper.get('[data-testid="sheet-type-oneshot"]').setValue(true)

    expect(wrapper.emitted('change')?.[0]).toEqual([{ ...NO_FILTERS, type: ['series', 'oneshot'] }])
    expect(wrapper.get('[data-testid="filters-sheet-apply"]').text()).toContain('12')
  })

  it('décoche une valeur et replie les groupes depuis la feuille', async () => {
    const wrapper = await mountFilters({ ...NO_FILTERS, format: ['manga'] })

    await wrapper.get('[data-testid="sheet-format-manga"]').setValue(false)
    expect(wrapper.emitted('change')?.[0]).toEqual([NO_FILTERS])

    const collapse = wrapper.get('[data-testid="filters-sheet-collapse"]')
    expect(collapse.text()).toBe('Tout replier')
    await collapse.trigger('click')
    expect(collapse.text()).toBe('Tout déplier')
    const lists = wrapper.findAll('.filter-group__list')
    expect(lists).toHaveLength(4)
    expect(lists.every((list) => list.attributes('style')?.includes('display: none'))).toBe(true)
  })

  it('réinitialise depuis la feuille', async () => {
    const wrapper = await mountFilters({ ...NO_FILTERS, type: ['series'] })

    await wrapper.get('[data-testid="filters-sheet-reset"]').trigger('click')

    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('réinitialise tous les filtres quand il y en a', async () => {
    const wrapper = await mountFilters({ ...NO_FILTERS, type: ['series'] })

    await wrapper.get('[data-testid="filter-reset"]').trigger('click')

    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('propose « Réinitialiser » dès que seul l’état est choisi, et le compte sur « Filtres »', async () => {
    const wrapper = await mountFilters(NO_FILTERS, { state: 'draft' })

    expect(wrapper.find('[data-testid="filter-reset"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="filters-open"]').text()).toBe('Filtres (1)')
  })

  it('choisit l’état dans la feuille mobile : un second choix identique revient à « tous »', async () => {
    const wrapper = await mountFilters()

    await wrapper.get('[data-testid="sheet-state-draft"]').setValue(true)
    expect(wrapper.emitted('state')?.[0]).toEqual(['draft'])

    const draftOnly = await mountFilters(NO_FILTERS, { state: 'draft' })
    await draftOnly.get('[data-testid="sheet-state-draft"]').setValue(false)
    expect(draftOnly.emitted('state')?.[0]).toEqual(['all'])
  })

  it('ne garde que l’état pour les personnes et les éditeurs', async () => {
    const wrapper = await mountFilters(NO_FILTERS, { kind: 'people' })

    expect(wrapper.find('[data-testid="admin-state-filter"]').exists()).toBe(true)
    for (const testId of ['filter-type', 'filter-format', 'filter-status', 'filter-sort']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).exists()).toBe(false)
    }
    expect(wrapper.findAll('.filter-group')).toHaveLength(1)
  })
})
