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

  it('propose les variantes d’enregistrement (vert) et d’action destructrice', async () => {
    for (const variant of ['success', 'danger', 'danger-solid'] as const) {
      const wrapper = await mountSuspended(UiButton, { props: { variant } })
      expect(wrapper.classes()).toContain(`btn--${variant}`)
    }
  })

  it('devient un lien quand une adresse est donnée', async () => {
    const wrapper = await mountSuspended(UiButton, {
      props: { href: '/api/v1/auth/google' },
      slots: { default: 'Google' },
    })

    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/api/v1/auth/google')
    expect(wrapper.attributes('type')).toBeUndefined()
  })

  it('devient un lien interne du site quand une destination est donnée', async () => {
    const wrapper = await mountSuspended(UiButton, {
      props: { to: '/admin/catalogue' },
      slots: { default: 'Catalogue' },
    })

    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/admin/catalogue')
    expect(wrapper.attributes('type')).toBeUndefined()
  })

  it('passe en pleine largeur à la demande', async () => {
    const wrapper = await mountSuspended(UiButton, { props: { block: true } })

    expect(wrapper.classes()).toContain('btn--block')
    expect((await mountSuspended(UiButton)).classes()).not.toContain('btn--block')
  })

  it('prend la couleur du statut de lecture', async () => {
    const wrapper = await mountSuspended(UiButton, { props: { status: 'on_hold' } })

    expect(wrapper.classes()).toContain('btn--status-on_hold')
  })
})
