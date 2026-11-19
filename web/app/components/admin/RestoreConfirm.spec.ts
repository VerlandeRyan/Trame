import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminRestoreConfirm from './RestoreConfirm.vue'

const mountConfirm = () => mountSuspended(AdminRestoreConfirm, { props: { modelValue: true } })

describe('AdminRestoreConfirm', () => {
  it('dit que la fiche redevient visible du public', async () => {
    const wrapper = await mountConfirm()

    expect(wrapper.text()).toContain('Restaurer cette fiche ?')
    expect(wrapper.text()).toContain('redevient visible du public')
  })

  it('n’est pas rouge et émet la confirmation', async () => {
    const wrapper = await mountConfirm()
    const accept = wrapper.get('[data-testid="confirm-accept"]')

    expect(accept.classes()).not.toContain('btn--danger-solid')
    await accept.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('n’émet rien quand on annule', async () => {
    const wrapper = await mountConfirm()

    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
