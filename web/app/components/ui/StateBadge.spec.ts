import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiStateBadge from './StateBadge.vue'

describe('UiStateBadge', () => {
  it.each(['published', 'archived'] as const)(
    'affiche son contenu, porte la teinte « %s » et laisse passer les attributs',
    async (state) => {
      const wrapper = await mountSuspended(UiStateBadge, {
        props: { state },
        slots: { default: 'Publiée' },
        attrs: { 'data-testid': 'admin-state' },
      })

      expect(wrapper.text()).toBe('Publiée')
      expect(wrapper.classes()).toContain(`state-badge--${state}`)
      expect(wrapper.attributes('data-testid')).toBe('admin-state')
    },
  )
})
