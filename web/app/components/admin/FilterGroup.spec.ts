import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminFilterGroup from './FilterGroup.vue'

const options = [
  { value: 'series', label: 'Série' },
  { value: 'oneshot', label: 'One-shot' },
]

const mountGroup = (selected: string[] = [], open = true) =>
  mountSuspended(AdminFilterGroup, {
    props: { name: 'type', label: 'Type', options, selected, open },
  })

describe('AdminFilterGroup', () => {
  it('liste les valeurs en cases à cocher, avec celles qui sont choisies cochées', async () => {
    const wrapper = await mountGroup(['oneshot'])

    expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['Série', 'One-shot'])
    expect(
      (wrapper.get('[data-testid="sheet-type-oneshot"]').element as HTMLInputElement).checked,
    ).toBe(true)
    expect(wrapper.get('.filter-group__badge').text()).toBe('1')
  })

  it('émet la valeur cochée', async () => {
    const wrapper = await mountGroup()

    await wrapper.get('[data-testid="sheet-type-series"]').setValue(true)

    expect(wrapper.emitted('toggle')).toEqual([['series']])
  })

  it('se replie et se déplie par son titre', async () => {
    const wrapper = await mountGroup()

    await wrapper.get('.filter-group__title').trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.get('.filter-group__title').attributes('aria-expanded')).toBe('false')
  })
})
