import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiChip from './Chip.vue'

describe('UiChip', () => {
  it('affiche son contenu', async () => {
    const wrapper = await mountSuspended(UiChip, { slots: { default: 'Manga' } })

    expect(wrapper.text()).toBe('Manga')
  })
})
