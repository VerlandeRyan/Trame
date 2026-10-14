import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import DefaultLayout from './default.vue'

describe('mise en page par défaut', () => {
  it("place l'en-tête avant le contenu de la page", async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: '<p>Contenu de la page</p>' },
    })

    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.get('main#contenu').text()).toBe('Contenu de la page')
  })

  it("propose un lien d'évitement vers le contenu", async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const skipLink = wrapper.get('a[href="#contenu"]')

    expect(skipLink.text()).toBe('Aller au contenu')
  })
})
