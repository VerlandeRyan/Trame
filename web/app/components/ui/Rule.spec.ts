import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiRule from './Rule.vue'

describe('UiRule', () => {
  it('est purement décorative', async () => {
    const wrapper = await mountSuspended(UiRule)

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('')
  })
})
