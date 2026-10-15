import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SearchResultItem from './ResultItem.vue'
import type { WorkSummary } from '~/utils/search'

const work: WorkSummary = {
  id: 42,
  title: 'Marée creuse',
  originalTitle: 'Hollow Tide',
  originalLanguage: 'en',
  type: 'series',
  status: 'ongoing',
  formats: ['webtoon', 'format_inconnu'],
  coverPath: null,
  mainAuthor: 'Auteur A',
}

describe('SearchResultItem', () => {
  it('affiche titre, titre original, étiquettes, auteur et statut', async () => {
    const wrapper = await mountSuspended(SearchResultItem, { props: { work } })

    expect(wrapper.get('h3').text()).toBe('Marée creuse')
    expect(wrapper.get('h3 a').attributes('href')).toBe('/work/42-maree-creuse')
    expect(wrapper.text()).toContain('EN : Hollow Tide')
    // Un code de format sans traduction s'affiche tel quel.
    expect(wrapper.findAll('li').map((item) => item.text())).toEqual([
      'Série',
      'Webtoon',
      'format_inconnu',
    ])
    expect(wrapper.text()).toContain('Auteur A · En cours')
  })

  it('omet l’auteur absent', async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: { work: { ...work, mainAuthor: null, formats: [] } },
    })

    expect(wrapper.get('.result__meta').text()).toBe('En cours')
  })

  it('donne la langue et le titre d’origine même quand le titre affiché est déjà l’original', async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: { work: { ...work, title: 'Hollow Tide' } },
    })

    expect(wrapper.get('[data-testid="result-original"]').text()).toBe('EN : Hollow Tide')
  })

  it("n'affiche pas la langue d'origine quand c'est celle de l'interface", async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: {
        work: {
          ...work,
          title: 'Aube Fictive',
          originalTitle: 'Aube Fictive',
          originalLanguage: 'fr',
        },
      },
    })

    expect(wrapper.find('[data-testid="result-original"]').exists()).toBe(false)
  })

  it('met la langue d’origine en majuscules, quelle qu’elle soit', async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: { work: { ...work, title: 'Hollow Tide', originalLanguage: 'ja' } },
    })

    expect(wrapper.get('[data-testid="result-original"]').text()).toBe('JA : Hollow Tide')
  })

  it("garde « Ajouter » visible mais inactif jusqu'à #23", async () => {
    const wrapper = await mountSuspended(SearchResultItem, { props: { work } })

    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-label')).toBe('Ajouter « Marée creuse » à ma liste')
  })
})
