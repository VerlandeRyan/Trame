import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminDeleteConfirm from './DeleteConfirm.vue'

const mountConfirm = (target: 'draft' | 'archive') =>
  mountSuspended(AdminDeleteConfirm, { props: { modelValue: true, target } })

describe('AdminDeleteConfirm', () => {
  it('dit qu’un brouillon n’a jamais été publié', async () => {
    const wrapper = await mountConfirm('draft')

    expect(wrapper.text()).toContain('Supprimer ce brouillon ?')
    expect(wrapper.text()).toContain("il n'a jamais été publié")
  })

  it('dit qu’une suppression d’archive est irréversible', async () => {
    const wrapper = await mountConfirm('archive')

    expect(wrapper.text()).toContain('Supprimer définitivement cette fiche ?')
    expect(wrapper.text()).toContain('irréversible')
  })

  it('est en rouge et émet la confirmation', async () => {
    const wrapper = await mountConfirm('archive')
    const accept = wrapper.get('[data-testid="confirm-accept"]')

    expect(accept.classes()).toContain('btn--danger-solid')
    await accept.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
