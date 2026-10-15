import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import LayoutHeader from './Header.vue'

describe('LayoutHeader', () => {
  it('présente le logo, la recherche, la langue et la connexion', async () => {
    const wrapper = await mountSuspended(LayoutHeader)

    expect(wrapper.get('header a').text()).toBe('Trame')
    expect(wrapper.get('[role="combobox"]').attributes('placeholder')).toBe(
      'Rechercher une œuvre, un auteur…',
    )
    expect(wrapper.find('button[aria-haspopup]').text()).toBe('FR')
    expect(wrapper.findAll('button').at(-1)?.text()).toBe('Se connecter')
  })

  it('propose au mobile une icône qui déploie le champ, sans quitter la page', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: '/' })
    const open = wrapper.get('[data-testid="search-open"]')

    expect(open.element.tagName).toBe('BUTTON')
    expect(open.attributes('aria-label')).toBe('Ouvrir la recherche')
    expect(open.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('header').classes()).not.toContain('layout-header--searching')

    await open.trigger('click')

    expect(wrapper.get('header').classes()).toContain('layout-header--searching')
    expect(open.attributes('aria-expanded')).toBe('true')
    expect(useRoute().path).toBe('/')
  })

  it('referme le champ déployé avec la croix, avec Échap, ou en changeant de page', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: '/' })
    const searching = () => wrapper.get('header').classes().includes('layout-header--searching')

    await wrapper.get('[data-testid="search-open"]').trigger('click')
    await wrapper.get('[data-testid="search-close"]').trigger('click')
    expect(searching()).toBe(false)
    expect(wrapper.get('[data-testid="search-close"]').attributes('aria-label')).toBe(
      'Fermer la recherche',
    )

    await wrapper.get('[data-testid="search-open"]').trigger('click')
    await wrapper.get('header').trigger('keydown', { key: 'Escape' })
    expect(searching()).toBe(false)

    await wrapper.get('[data-testid="search-open"]').trigger('click')
    await navigateTo('/search?q=tit')
    await vi.waitFor(() => expect(searching()).toBe(false))
  })

  it("masque l'icône sur la page de recherche, où le champ est déjà affiché", async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: '/search' })

    expect(wrapper.find('[data-testid="search-open"]').exists()).toBe(false)
  })
})
