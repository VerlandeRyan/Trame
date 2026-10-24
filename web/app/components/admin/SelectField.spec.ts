import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminSelectField from './SelectField.vue'

const OPTIONS = [
  { value: 'official', label: 'Officiel' },
  { value: 'human', label: 'Contributeur' },
]

const mountField = () =>
  mountSuspended(AdminSelectField, {
    props: { modelValue: 'official', options: OPTIONS, label: 'Source' },
  })

describe('AdminSelectField', () => {
  it('affiche son nom au-dessus du choix en cours', async () => {
    const wrapper = await mountField()

    expect(wrapper.get('.select-field__label').text()).toBe('Source')
    expect(wrapper.get('[role="combobox"]').text()).toContain('Officiel')
  })

  it('émet le choix fait dans la liste', async () => {
    const wrapper = await mountField()

    await wrapper.get('[role="combobox"]').trigger('click')
    const option = wrapper.findAll('[role="option"]').find((item) => item.text() === 'Contributeur')
    await option!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['human'])
  })
})
