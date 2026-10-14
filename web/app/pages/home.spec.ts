import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HomePage from './home.vue'

describe("page d'accueil", () => {
  let initialValue: boolean

  beforeEach(() => {
    initialValue = useRuntimeConfig().public.componentGallery
  })

  afterEach(() => {
    useRuntimeConfig().public.componentGallery = initialValue
  })

  it("affiche le titre et l'introduction", async () => {
    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.get('[data-testid="home-title"]').text()).toBe('Trame')
    expect(wrapper.get('[data-testid="home-intro"]').text()).toContain('Suis tes lectures')
  })

  it('propose le lien vers la galerie quand elle est activée', async () => {
    useRuntimeConfig().public.componentGallery = true

    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.get('a[href="/components"]').text()).toBe('Voir les composants')
  })

  it('masque le lien vers la galerie quand elle est désactivée', async () => {
    useRuntimeConfig().public.componentGallery = false

    const wrapper = await mountSuspended(HomePage)

    expect(wrapper.find('a[href="/components"]').exists()).toBe(false)
  })
})
