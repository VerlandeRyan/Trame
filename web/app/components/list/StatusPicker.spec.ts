import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import ListStatusPicker from './StatusPicker.vue'

const mountPicker = () =>
  mountSuspended(ListStatusPicker, { props: { status: 'reading', title: 'Aube' } })

describe('ListStatusPicker', () => {
  it('montre le statut actuel et son nom accessible', async () => {
    const wrapper = await mountPicker()

    const trigger = wrapper.get('[data-testid="list-status"]')
    expect(trigger.text()).toContain('En cours')
    expect(trigger.attributes('aria-label')).toContain('Aube')
  })

  it('ouvre le menu des cinq statuts et marque le statut actuel', async () => {
    const wrapper = await mountPicker()

    await wrapper.get('[data-testid="list-status"]').trigger('click')

    const items = wrapper.findAll('[role="menuitemradio"]')
    expect(items).toHaveLength(5)
    expect(wrapper.get('[data-testid="list-status-reading"]').attributes('aria-checked')).toBe(
      'true',
    )
  })

  it('s’ouvre au-dessus du bouton près du bas de l’écran, au-dessous sinon', async () => {
    const wrapper = await mountPicker()
    const trigger = wrapper.get('[data-testid="list-status"]')
    const rect = vi.spyOn(trigger.element, 'getBoundingClientRect')

    rect.mockReturnValue({
      top: window.innerHeight - 50,
      bottom: window.innerHeight - 10,
    } as DOMRect)
    await trigger.trigger('click')
    expect(wrapper.get('[role="menu"]').classes()).toContain('status-picker__panel--above')

    await trigger.trigger('click')
    rect.mockReturnValue({ top: 20, bottom: 60 } as DOMRect)
    await trigger.trigger('click')
    expect(wrapper.get('[role="menu"]').classes()).not.toContain('status-picker__panel--above')
  })

  it('émet le nouveau statut et referme le menu', async () => {
    const wrapper = await mountPicker()
    await wrapper.get('[data-testid="list-status"]').trigger('click')

    await wrapper.get('[data-testid="list-status-on_hold"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([['on_hold']])
    expect(wrapper.get('[data-testid="list-status"]').attributes('aria-expanded')).toBe('false')
  })

  it('n’émet rien quand on rechoisit le statut actuel', async () => {
    const wrapper = await mountPicker()
    await wrapper.get('[data-testid="list-status"]').trigger('click')

    await wrapper.get('[data-testid="list-status-reading"]').trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
