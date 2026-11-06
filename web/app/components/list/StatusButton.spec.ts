import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ListStatusButton from './StatusButton.vue'

const mountButton = () =>
  mountSuspended(ListStatusButton, { props: { status: 'reading', title: 'Aube' } })

describe('ListStatusButton', () => {
  it('montre le statut actuel et son nom accessible', async () => {
    const wrapper = await mountButton()

    const trigger = wrapper.get('[data-testid="list-status"]')
    expect(trigger.text()).toContain('En cours')
    expect(trigger.attributes('aria-label')).toContain('Aube')
  })

  it('ouvre le menu des cinq statuts et marque le statut actuel', async () => {
    const wrapper = await mountButton()

    await wrapper.get('[data-testid="list-status"]').trigger('click')

    const items = wrapper.findAll('[role="menuitemradio"]')
    expect(items).toHaveLength(5)
    expect(wrapper.get('[data-testid="list-status-reading"]').attributes('aria-checked')).toBe(
      'true',
    )
  })

  it('émet le nouveau statut et referme le menu', async () => {
    const wrapper = await mountButton()
    await wrapper.get('[data-testid="list-status"]').trigger('click')

    await wrapper.get('[data-testid="list-status-on_hold"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([['on_hold']])
    expect(wrapper.get('[data-testid="list-status"]').attributes('aria-expanded')).toBe('false')
  })

  it('n’émet rien quand on rechoisit le statut actuel', async () => {
    const wrapper = await mountButton()
    await wrapper.get('[data-testid="list-status"]').trigger('click')

    await wrapper.get('[data-testid="list-status-reading"]').trigger('click')

    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
