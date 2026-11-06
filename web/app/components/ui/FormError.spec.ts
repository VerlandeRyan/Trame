import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { Icon } from '#components'
import UiFormError from './FormError.vue'

describe('UiFormError', () => {
  it("annonce le message comme une alerte, avec l'icône d'alerte", async () => {
    const wrapper = await mountSuspended(UiFormError, { slots: { default: 'Pseudo déjà pris' } })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Pseudo déjà pris')
    expect(wrapper.findComponent(Icon).props('name')).toBe('tabler:alert-circle')
  })

  it("garde l'identifiant et les attributs de test de l'appelant", async () => {
    const wrapper = await mountSuspended(UiFormError, {
      attrs: { id: 'handle-error', 'data-testid': 'handle-error' },
      slots: { default: 'Erreur' },
    })

    expect(wrapper.attributes('id')).toBe('handle-error')
    expect(wrapper.attributes('data-testid')).toBe('handle-error')
  })
})
