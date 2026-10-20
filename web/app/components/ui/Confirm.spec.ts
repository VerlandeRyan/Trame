import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiConfirm from './Confirm.vue'

function mountConfirm(isOpen = true) {
  return mountSuspended(UiConfirm, {
    props: {
      modelValue: isOpen,
      title: 'Annuler ?',
      text: 'Rien ne sera enregistré.',
      confirmLabel: 'Oui, annuler',
      cancelLabel: 'Non, continuer',
      closeLabel: 'Fermer',
    },
  })
}

describe('UiConfirm', () => {
  it('explique ce qui va se passer et propose les deux issues', async () => {
    const wrapper = await mountConfirm()

    expect(wrapper.get('h2').text()).toBe('Annuler ?')
    expect(wrapper.text()).toContain('Rien ne sera enregistré.')
    expect(wrapper.get('[data-testid="confirm-cancel"]').text()).toBe('Non, continuer')
    expect(wrapper.get('[data-testid="confirm-accept"]').text()).toBe('Oui, annuler')
  })

  it('se referme sans rien déclencher quand on garde les choses en l’état', async () => {
    const wrapper = await mountConfirm()

    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('se referme et prévient quand on confirme', async () => {
    const wrapper = await mountConfirm()

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
