import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AdminRowDropdown from './RowDropdown.vue'

const mountDropdown = () =>
  mountSuspended(AdminRowDropdown, {
    props: { label: 'Actions de Basalte' },
    attachTo: document.body,
  })

describe('AdminRowDropdown', () => {
  it('ouvre un menu à une seule ligne et porte le nom de la fiche', async () => {
    const wrapper = await mountDropdown()
    const trigger = wrapper.get('[data-testid="admin-row-menu"]')
    expect(trigger.attributes('aria-label')).toBe('Actions de Basalte')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('[role="menuitem"]')).toHaveLength(1)
    expect(wrapper.get('[role="menu"]').text()).toBe('Supprimer définitivement')
    wrapper.unmount()
  })

  it('met le focus sur la ligne à l’ouverture et le rend au « ⋮ » à la fermeture', async () => {
    const wrapper = await mountDropdown()
    const trigger = wrapper.get('[data-testid="admin-row-menu"]')

    await trigger.trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[role="menuitem"]').element)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('se referme par un clic à côté', async () => {
    const wrapper = await mountDropdown()

    await wrapper.get('[data-testid="admin-row-menu"]').trigger('click')
    document.body.click()
    await flushPromises()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('se referme et émet la demande de suppression', async () => {
    const wrapper = await mountDropdown()

    await wrapper.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-dropdown-remove"]').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
