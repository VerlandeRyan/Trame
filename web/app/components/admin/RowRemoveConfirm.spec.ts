import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminRowRemoveConfirm from './RowRemoveConfirm.vue'

function mountConfirm() {
  return mountSuspended(AdminRowRemoveConfirm, {
    props: { modelValue: true },
    attachTo: document.body,
  })
}

describe('AdminRowRemoveConfirm', () => {
  it('prévient que la saisie sera perdue, avec le bouton de confirmation rouge', async () => {
    const wrapper = await mountConfirm()

    expect(wrapper.text()).toContain('Retirer cette ligne')
    expect(wrapper.get('[data-testid="confirm-accept"]').classes()).toContain('btn--danger-solid')
    wrapper.unmount()
  })

  it('émet « confirm » seulement au clic sur « Retirer »', async () => {
    const wrapper = await mountConfirm()

    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()

    await wrapper.setProps({ modelValue: true })
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })
})
