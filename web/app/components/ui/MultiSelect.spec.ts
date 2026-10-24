import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MultiSelect from './MultiSelect.vue'

const OPTIONS = [
  { value: 'series', label: 'Série' },
  { value: 'oneshot', label: 'One-shot' },
  { value: 'anthology', label: 'Anthologie' },
]

const mountSelect = (modelValue: string[] = []) =>
  mountSuspended(MultiSelect, {
    props: {
      modelValue,
      options: OPTIONS,
      label: 'Type',
      emptyLabel: 'Tous',
      clearLabel: 'Tout effacer',
      triggerTestId: 'type',
    },
  })

describe('UiMultiSelect', () => {
  it('affiche « Tous » quand rien n’est coché', async () => {
    const wrapper = await mountSelect()

    expect(wrapper.get('[data-testid="type"]').text()).toContain('Tous')
    expect(wrapper.find('[data-testid="multi-select-count"]').exists()).toBe(false)
  })

  it('affiche la première valeur et le nombre des suivantes', async () => {
    const wrapper = await mountSelect(['oneshot', 'series', 'anthology'])

    expect(wrapper.get('[data-testid="type"]').text()).toContain('One-shot')
    expect(wrapper.get('[data-testid="multi-select-count"]').text()).toBe('+2')
  })

  it('ouvre et ferme le panneau au clic sur le bouton', async () => {
    const wrapper = await mountSelect()
    const trigger = wrapper.get('[data-testid="type"]')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('coche et décoche des valeurs', async () => {
    const wrapper = await mountSelect(['series'])

    await wrapper.get('[data-testid="type-oneshot"]').setValue(true)
    await wrapper.get('[data-testid="type-series"]').setValue(false)

    expect(wrapper.emitted('update:modelValue')).toEqual([[['series', 'oneshot']], [['oneshot']]])
  })

  it('efface tout, sauf quand il n’y a rien à effacer', async () => {
    const empty = await mountSelect()
    expect(empty.get('.multi-select__clear').attributes('disabled')).toBeDefined()

    const wrapper = await mountSelect(['series'])
    await wrapper.get('.multi-select__clear').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[]])
  })
})
