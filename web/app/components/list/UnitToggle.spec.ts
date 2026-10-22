import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ListUnitToggle from './UnitToggle.vue'

const mountToggle = (unit: 'chapters' | 'volumes' = 'chapters') =>
  mountSuspended(ListUnitToggle, { props: { modelValue: unit } })

describe('ListUnitToggle', () => {
  it('marque l’unité choisie et nomme chaque bouton', async () => {
    const wrapper = await mountToggle('volumes')

    expect(wrapper.get('[data-testid="list-unit-volumes"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="list-unit-chapters"]').attributes('aria-pressed')).toBe(
      'false',
    )
    expect(wrapper.get('[data-testid="list-unit-chapters"]').attributes('aria-label')).toBe(
      'Chapitres',
    )
  })

  it('émet l’unité choisie', async () => {
    const wrapper = await mountToggle()

    await wrapper.get('[data-testid="list-unit-volumes"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['volumes']])
  })
})
