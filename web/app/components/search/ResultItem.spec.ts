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

/** A visitor's view of a result; tests override what they need. */
const listProps: {
  work: WorkSummary
  isSignedIn: boolean
  isListed: boolean
  isListLoaded: boolean
} = { work, isSignedIn: false, isListed: false, isListLoaded: false }

describe('SearchResultItem', () => {
  it('affiche titre, titre original, étiquettes, auteur et statut', async () => {
    const wrapper = await mountSuspended(SearchResultItem, { props: listProps })

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
      props: { ...listProps, work: { ...work, mainAuthor: null, formats: [] } },
    })

    expect(wrapper.get('.result__meta').text()).toBe('En cours')
  })

  it('donne la langue et le titre d’origine même quand le titre affiché est déjà l’original', async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: { ...listProps, work: { ...work, title: 'Hollow Tide' } },
    })

    expect(wrapper.get('[data-testid="result-original"]').text()).toBe('EN : Hollow Tide')
  })

  it("n'affiche pas la langue d'origine quand c'est celle de l'interface", async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: {
        ...listProps,
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
      props: { ...listProps, work: { ...work, title: 'Hollow Tide', originalLanguage: 'ja' } },
    })

    expect(wrapper.get('[data-testid="result-original"]').text()).toBe('JA : Hollow Tide')
  })

  it('propose « Ajouter » à un visiteur et à un connecté dont la liste n’a pas l’œuvre', async () => {
    for (const props of [
      { ...listProps, isSignedIn: false, isListLoaded: false },
      { ...listProps, isSignedIn: true, isListLoaded: true },
    ]) {
      const wrapper = await mountSuspended(SearchResultItem, { props })

      const button = wrapper.get('[data-testid="result-add"]')
      expect(button.attributes('disabled')).toBeUndefined()
      expect(button.attributes('aria-label')).toBe('Ajouter « Marée creuse » à ma liste')
      await button.trigger('click')
      expect(wrapper.emitted('add')).toHaveLength(1)
    }
  })

  it('n’offre ni « Ajouter » ni statut tant que les statuts ne sont pas lus', async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: { ...listProps, isSignedIn: true, isListLoaded: false },
    })

    expect(wrapper.find('[data-testid="result-loading"]').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('n’offre aucun bouton pour une œuvre déjà dans la liste', async () => {
    const wrapper = await mountSuspended(SearchResultItem, {
      props: { ...listProps, isSignedIn: true, isListLoaded: true, isListed: true },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[data-testid="result-loading"]').exists()).toBe(false)
  })
})
