import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import LayoutExploreMenu from './ExploreMenu.vue'

const facets = {
  type: [],
  status: [],
  originalLanguage: [],
  format: [
    { code: 'bd', count: 4 },
    { code: 'manga', count: 9 },
  ],
  genre: [{ code: 'fantasy', count: 5 }],
}

const panelHidden = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) =>
  (wrapper.get('[data-testid="explore-panel"]').element as HTMLElement).style.display === 'none'

describe('LayoutExploreMenu', () => {
  it('affiche un bouton « Explorer » fermé, sans appeler l’API avant l’ouverture', async () => {
    const endpoint = vi.fn(() => facets)
    registerEndpoint('/api/v1/works/facets', endpoint)
    const wrapper = await mountSuspended(LayoutExploreMenu)
    const trigger = wrapper.get('[data-testid="explore-open"]')

    expect(trigger.text()).toBe('Explorer')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(panelHidden(wrapper)).toBe(true)
    expect(endpoint).not.toHaveBeenCalled()
  })

  it('liste formats et genres avec leurs compteurs, dans l’ordre éditorial', async () => {
    registerEndpoint('/api/v1/works/facets', () => facets)
    const wrapper = await mountSuspended(LayoutExploreMenu)

    await wrapper.get('[data-testid="explore-open"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="explore-format-manga"]').exists()).toBe(true),
    )

    expect(wrapper.get('[data-testid="explore-open"]').attributes('aria-expanded')).toBe('true')
    const formats = wrapper.findAll('[data-testid^="explore-format-"]')
    expect(formats.map((link) => link.attributes('href'))).toEqual([
      '/search?format=manga',
      '/search?format=bd',
    ])
    expect(formats[0]?.text()).toContain('9')
    expect(wrapper.get('[data-testid="explore-genre-fantasy"]').attributes('href')).toBe(
      '/search?genre=fantasy',
    )
    expect(wrapper.get('[data-testid="explore-all-catalog"]').attributes('href')).toBe('/search')
  })

  it('garde le lien vers le catalogue quand les compteurs ne se chargent pas', async () => {
    registerEndpoint('/api/v1/works/facets', () => {
      throw createError({ statusCode: 500 })
    })
    const wrapper = await mountSuspended(LayoutExploreMenu)

    await wrapper.get('[data-testid="explore-open"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid^="explore-format-"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="explore-all-catalog"]').exists()).toBe(true)
  })

  it('se referme avec Échap, en rendant le focus au bouton', async () => {
    registerEndpoint('/api/v1/works/facets', () => facets)
    const wrapper = await mountSuspended(LayoutExploreMenu, { attachTo: document.body })
    const trigger = wrapper.get('[data-testid="explore-open"]')

    await trigger.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('se referme au clic en dehors, mais pas au clic dedans', async () => {
    registerEndpoint('/api/v1/works/facets', () => facets)
    const wrapper = await mountSuspended(LayoutExploreMenu, { attachTo: document.body })
    const trigger = wrapper.get('[data-testid="explore-open"]')

    await trigger.trigger('click')
    await wrapper.get('[data-testid="explore-panel"]').trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    document.body.click()
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('se referme quand la route change', async () => {
    registerEndpoint('/api/v1/works/facets', () => facets)
    const wrapper = await mountSuspended(LayoutExploreMenu)
    const trigger = wrapper.get('[data-testid="explore-open"]')

    await trigger.trigger('click')
    await navigateTo('/search?format=bd')
    await vi.waitFor(() => expect(trigger.attributes('aria-expanded')).toBe('false'))
  })
})
