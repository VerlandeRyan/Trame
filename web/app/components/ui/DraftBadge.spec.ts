import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiDraftBadge from './DraftBadge.vue'

describe('UiDraftBadge', () => {
  it('affiche son contenu et laisse passer les attributs', async () => {
    const wrapper = await mountSuspended(UiDraftBadge, {
      slots: { default: 'Brouillon' },
      attrs: { 'data-testid': 'admin-draft' },
    })

    expect(wrapper.text()).toBe('Brouillon')
    expect(wrapper.attributes('data-testid')).toBe('admin-draft')
  })
})
