import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HomeExplore from './Explore.vue'
import type { GenreItem } from '~/utils/home'

const genres: GenreItem[] = [
  { code: 'manga', category: 'format' },
  { code: 'webtoon', category: 'format' },
  { code: 'fantasy', category: 'theme' },
  { code: 'code_inconnu', category: 'theme' },
]

describe('HomeExplore', () => {
  it('propose les formats puis les genres, chacun menant à la recherche filtrée', async () => {
    const wrapper = await mountSuspended(HomeExplore, { props: { genres } })

    const manga = wrapper.get('[data-testid="explore-format-manga"]')
    expect(manga.text()).toBe('Manga')
    expect(manga.attributes('href')).toBe('/search?format=manga')
    expect(wrapper.get('[data-testid="explore-genre-fantasy"]').attributes('href')).toBe(
      '/search?genre=fantasy',
    )
    // Un code sans traduction s'affiche tel quel.
    expect(wrapper.get('[data-testid="explore-genre-code_inconnu"]').text()).toBe('code_inconnu')
  })

  it('termine chaque groupe par un lien vers toute la recherche', async () => {
    const wrapper = await mountSuspended(HomeExplore, { props: { genres } })

    expect(wrapper.get('[data-testid="explore-all-formats"]').attributes('href')).toBe('/search')
    expect(wrapper.get('[data-testid="explore-all-genres"]').text()).toContain('Tous les genres')
  })

  it('omet le groupe des genres quand il n’y en a aucun', async () => {
    const wrapper = await mountSuspended(HomeExplore, {
      props: { genres: [{ code: 'bd', category: 'format' }] },
    })

    expect(wrapper.find('[data-testid="explore-all-genres"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="explore-all-formats"]').exists()).toBe(true)
  })
})
