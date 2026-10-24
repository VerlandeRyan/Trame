import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminPillGroup from './PillGroup.vue'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bêta' },
  { value: 'c', label: 'Gamma' },
]

describe('AdminPillGroup', () => {
  it('choix unique : coche la pastille courante et émet la nouvelle valeur', async () => {
    const wrapper = await mountSuspended(AdminPillGroup, {
      props: { label: 'Type', options: OPTIONS, modelValue: 'a' },
    })

    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(3)
    expect((wrapper.get('[data-testid="pill-a"]').element as HTMLInputElement).checked).toBe(true)
    await wrapper.get('[data-testid="pill-c"]').trigger('change')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['c'])
  })

  it('choix multiple : ajoute puis retire une valeur', async () => {
    const wrapper = await mountSuspended(AdminPillGroup, {
      props: { label: 'Genres', options: OPTIONS, multiple: true, modelValue: ['a'] },
    })

    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
    await wrapper.get('[data-testid="pill-b"]').trigger('change')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['a', 'b']])

    await wrapper.get('[data-testid="pill-a"]').trigger('change')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([['b']])
  })

  it('nomme le groupe par sa légende', async () => {
    const wrapper = await mountSuspended(AdminPillGroup, {
      props: { label: 'Statut', options: OPTIONS, modelValue: 'b' },
    })

    expect(wrapper.get('legend').text()).toBe('Statut')
  })
})
