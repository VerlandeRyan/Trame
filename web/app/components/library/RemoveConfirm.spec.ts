import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import LibraryRemoveConfirm from './RemoveConfirm.vue'

function mountConfirm() {
  return mountSuspended(LibraryRemoveConfirm, {
    props: { modelValue: true },
    attachTo: document.body,
  })
}

describe('LibraryRemoveConfirm', () => {
  it('demande de retirer l’œuvre, avec le bouton de confirmation rouge', async () => {
    const wrapper = await mountConfirm()

    expect(wrapper.text()).toContain('Retirer cette œuvre de ta liste')
    expect(wrapper.get('[data-testid="confirm-accept"]').classes()).toContain('btn--danger-solid')
    wrapper.unmount()
  })

  it('émet « confirm » seulement au clic sur « Retirer de ma liste »', async () => {
    const wrapper = await mountConfirm()

    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()

    await wrapper.setProps({ modelValue: true })
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })
})
