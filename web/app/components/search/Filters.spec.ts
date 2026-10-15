import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SearchFilters from './Filters.vue'
import type { WorkFacets } from '~/utils/search'

const facets: WorkFacets = {
  type: [
    { code: 'series', count: 8 },
    { code: 'oneshot', count: 2 },
  ],
  format: [{ code: 'manga', count: 5 }],
  genre: [{ code: 'fantasy', count: 2 }],
  status: [{ code: 'ongoing', count: 7 }],
  originalLanguage: [{ code: 'fr', count: 10 }],
}

/** Groupes dans l'ordre d'affichage, avec leur état ouvert (`aria-expanded` du titre). */
function groups(wrapper: VueWrapper): [string, boolean][] {
  return wrapper
    .findAll('.filter-group__title')
    .map((title) => [title.text(), title.attributes('aria-expanded') === 'true'])
}

describe('SearchFilters', () => {
  it('déplie Type, Format et Genre ; Statut et Langue originale restent repliés', async () => {
    const wrapper = await mountSuspended(SearchFilters, { props: { facets, filters: {} } })

    expect(groups(wrapper)).toEqual([
      ['Type', true],
      ['Format', true],
      ['Genre', true],
      ['Statut de publication', false],
      ['Langue originale', false],
    ])
  })

  it('déplie un groupe dont une valeur est choisie', async () => {
    const wrapper = await mountSuspended(SearchFilters, {
      props: { facets, filters: { status: ['ongoing'] } },
    })

    expect(groups(wrapper).find(([name]) => name.startsWith('Statut'))?.[1]).toBe(true)
  })

  it('déplie le groupe d’une valeur choisie après coup', async () => {
    const wrapper = await mountSuspended(SearchFilters, { props: { facets, filters: {} } })

    await wrapper.setProps({ filters: { originalLanguage: ['fr'] } })

    expect(groups(wrapper).find(([name]) => name.startsWith('Langue'))?.[1]).toBe(true)
  })

  it('replie et déplie tout avec un seul lien', async () => {
    const wrapper = await mountSuspended(SearchFilters, { props: { facets, filters: {} } })
    const toggle = wrapper.get('.filters__collapse')
    // Tous les groupes ne sont pas dépliés au départ : le lien propose de tout déplier.
    expect(toggle.text()).toBe('Tout déplier')

    await toggle.trigger('click')
    expect(groups(wrapper).every(([, open]) => open)).toBe(true)
    expect(wrapper.get('.filters__collapse').text()).toBe('Tout replier')

    await wrapper.get('.filters__collapse').trigger('click')
    expect(groups(wrapper).every(([, open]) => !open)).toBe(true)
    expect(wrapper.get('.filters__collapse').text()).toBe('Tout déplier')
  })

  it('un groupe se replie seul sans toucher aux autres', async () => {
    const wrapper = await mountSuspended(SearchFilters, { props: { facets, filters: {} } })

    await wrapper.findAll('.filter-group__title')[0]!.trigger('click')

    expect(groups(wrapper).map(([, open]) => open)).toEqual([false, true, true, false, false])
  })

  it('affiche le titre et « Tout replier » dans la colonne du bureau', async () => {
    const wrapper = await mountSuspended(SearchFilters, { props: { facets, filters: {} } })

    expect(wrapper.get('h2').text()).toBe('Filtres')
    expect(wrapper.find('.filters__collapse').exists()).toBe(true)
  })

  it('dans la feuille mobile : groupes dépliés, sans titre, lien ni réinitialisation', async () => {
    const wrapper = await mountSuspended(SearchFilters, {
      props: { facets, filters: {}, sheet: true },
    })

    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.find('.filters__head').exists()).toBe(false)
    expect(wrapper.find('.filters__reset').exists()).toBe(false)
    expect(groups(wrapper).every(([, open]) => open)).toBe(true)
  })

  it('laisse la feuille piloter « Tout replier » par setAll et allOpen', async () => {
    const wrapper = await mountSuspended(SearchFilters, {
      props: { facets, filters: {}, sheet: true },
    })
    const exposed = wrapper.vm as unknown as { allOpen: boolean; setAll: (open: boolean) => void }
    expect(exposed.allOpen).toBe(true)

    exposed.setAll(false)
    await nextTick()

    expect(groups(wrapper).every(([, open]) => !open)).toBe(true)
    expect(exposed.allOpen).toBe(false)
  })

  it('transmet le groupe et la valeur cliquée, et la réinitialisation', async () => {
    const wrapper = await mountSuspended(SearchFilters, { props: { facets, filters: {} } })

    await wrapper.get('[data-testid="filter-format-manga"]').trigger('change')
    await wrapper.get('.filters__reset').trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([['format', 'manga']])
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })
})
