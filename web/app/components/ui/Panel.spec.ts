import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiPanel from './Panel.vue'

describe('UiPanel', () => {
  it('affiche son contenu', async () => {
    const wrapper = await mountSuspended(UiPanel, { slots: { default: 'Contenu' } })

    expect(wrapper.text()).toBe('Contenu')
  })
})
