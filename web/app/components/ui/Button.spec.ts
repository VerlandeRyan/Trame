import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiButton from './Button.vue'

describe('UiButton', () => {
  it('affiche son contenu dans un bouton', async () => {
    const wrapper = await mountSuspended(UiButton, { slots: { default: 'Ajouter' } })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).toBe('Ajouter')
  })

  it('applique la variante et la taille demandées', async () => {
    const wrapper = await mountSuspended(UiButton, { props: { variant: 'blue', size: 'small' } })

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['btn--blue', 'btn--small']))
  })

  it('prend la couleur du statut de lecture', async () => {
    const wrapper = await mountSuspended(UiButton, { props: { status: 'on_hold' } })

    expect(wrapper.classes()).toContain('btn--status-on_hold')
  })
})
