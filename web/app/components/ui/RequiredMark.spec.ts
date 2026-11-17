import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiRequiredMark from './RequiredMark.vue'

describe('UiRequiredMark', () => {
  it("affiche une étoile cachée des lecteurs d'écran", async () => {
    const wrapper = await mountSuspended(UiRequiredMark)

    expect(wrapper.text()).toBe('*')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })
})
