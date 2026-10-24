import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminNav from './Nav.vue'

describe('AdminNav', () => {
  it('place le catalogue entre deux entrées inactives', async () => {
    const wrapper = await mountSuspended(AdminNav)

    const items = wrapper.findAll('.admin-nav__item').map((item) => item.text())
    expect(items).toEqual(['Soumissions', 'Catalogue', 'Signalements'])
    expect(wrapper.get('[data-testid="admin-nav-catalogue"]').attributes('href')).toBe(
      '/admin/catalogue',
    )
    expect(
      wrapper.get('[data-testid="admin-nav-submissions"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.get('[data-testid="admin-nav-reports"]').attributes('disabled')).toBeDefined()
  })
})
