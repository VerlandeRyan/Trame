import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HomeShelf from './Shelf.vue'
import type { WorkSummary } from '~/utils/search'

const work: WorkSummary = {
  id: 7,
  title: 'Aube Fictive',
  originalTitle: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: 'Autrice Inventée',
}

describe('HomeShelf', () => {
  it('liste les œuvres avec lien vers la fiche, auteur et lien « Tout voir »', async () => {
    const wrapper = await mountSuspended(HomeShelf, {
      props: {
        testId: 'shelf',
        title: 'Récemment ajoutées',
        works: [work, { ...work, id: 8, title: 'Brume Fictive', mainAuthor: null }],
        seeAllTo: { path: '/search', query: { sort: 'recent' } },
      },
    })

    expect(wrapper.get('h2').text()).toBe('Récemment ajoutées')
    expect(wrapper.findAll('h3 a').map((link) => link.attributes('href'))).toEqual([
      '/work/7-aube-fictive',
      '/work/8-brume-fictive',
    ])
    expect(wrapper.findAll('.shelf__author').map((author) => author.text())).toEqual([
      'Autrice Inventée',
    ])
    const all = wrapper.get('a[aria-label="Tout voir : Récemment ajoutées"]')
    expect(all.attributes('href')).toBe('/search?sort=recent')
  })

  it('affiche la moyenne et le nombre de notes, sans « Tout voir » quand aucune page ne correspond', async () => {
    const wrapper = await mountSuspended(HomeShelf, {
      props: {
        testId: 'shelf',
        title: 'Les mieux notées',
        works: [{ ...work, ratingAverage: 9.1, ratingCount: 214 }],
      },
    })

    expect(wrapper.get('.shelf__rating').text()).toBe('9,1 · 214 notes')
    expect(wrapper.find('.shelf__all').exists()).toBe(false)
  })
})
