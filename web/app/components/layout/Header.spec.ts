import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import LayoutHeader from './Header.vue'

// Une page ordinaire : l'accueil et la recherche portent leur propre champ.
const WORK_ROUTE = '/work/1-aube-fictive'

describe('LayoutHeader', () => {
  it('présente le logo, la recherche, la langue et la connexion', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })

    expect(wrapper.get('header a').text()).toBe('Trame')
    expect(wrapper.get('[role="combobox"]').attributes('placeholder')).toBe(
      'Rechercher une œuvre, un auteur…',
    )
    expect(wrapper.find('button[aria-haspopup]').text()).toBe('FR')
    expect(wrapper.findAll('button').at(-1)?.text()).toBe('Se connecter')
  })

  it('propose au mobile une icône qui déploie le champ, sans quitter la page', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })
    const open = wrapper.get('[data-testid="search-open"]')

    expect(open.element.tagName).toBe('BUTTON')
    expect(open.attributes('aria-label')).toBe('Ouvrir la recherche')
    expect(open.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('header').classes()).not.toContain('layout-header--searching')

    await open.trigger('click')

    expect(wrapper.get('header').classes()).toContain('layout-header--searching')
    expect(open.attributes('aria-expanded')).toBe('true')
    expect(useRoute().path).toBe(WORK_ROUTE)
  })

  it('referme le champ déployé avec la croix, avec Échap, ou en changeant de page', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })
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

  it('porte le bouton Explorer', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })

    expect(wrapper.find('[data-testid="explore-open"]').exists()).toBe(true)
  })

  it('masque le bouton Explorer sur la page de recherche', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: '/search' })

    expect(wrapper.find('[data-testid="explore-open"]').exists()).toBe(false)
  })

  it('referme Explorer à chaque navigation, même vers une page qui le masque', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })

    await wrapper.get('[data-testid="explore-open"]').trigger('click')
    await navigateTo('/search?format=bd')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="explore-open"]').exists()).toBe(false),
    )
    await navigateTo(WORK_ROUTE)

    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="explore-open"]').attributes('aria-expanded')).toBe('false'),
    )
  })

  it('referme Explorer quand on ouvre la recherche', async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })
    const explore = wrapper.get('[data-testid="explore-open"]')

    await explore.trigger('click')
    expect(explore.attributes('aria-expanded')).toBe('true')
    await wrapper.get('[data-testid="search-open"]').trigger('click')

    expect(explore.attributes('aria-expanded')).toBe('false')
  })
})

describe('LayoutHeader et la connexion', () => {
  it('ouvre la fenêtre de connexion avec « Se connecter »', async () => {
    useSignInModal().value = false
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })

    await wrapper.get('[data-testid="sign-in"]').trigger('click')

    expect(useSignInModal().value).toBe(true)
  })

  it('montre le pseudo du membre connecté à la place du bouton', async () => {
    useState('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'Ryan', role: 'user' },
    }
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })

    expect(wrapper.find('[data-testid="sign-in"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="account-menu"]').text()).toBe('@Ryan')
    useState('auth').value = { status: 'anonymous' }
  })

  it('garde « Se connecter » tant que le pseudo n’est pas choisi', async () => {
    useState('auth').value = { status: 'pending' }
    const wrapper = await mountSuspended(LayoutHeader, { route: WORK_ROUTE })

    expect(wrapper.find('[data-testid="sign-in"]').exists()).toBe(true)
    useState('auth').value = { status: 'anonymous' }
  })
})

describe("LayoutHeader sur l'accueil", () => {
  it("n'a pas de champ de recherche : l'accueil porte le sien", async () => {
    const wrapper = await mountSuspended(LayoutHeader, { route: '/' })

    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="search-open"]').exists()).toBe(false)
    expect(wrapper.get('header').classes()).toContain('layout-header--plain')
    expect(wrapper.find('button[aria-haspopup]').text()).toBe('FR')
  })
})
