import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordRef } from '~/utils/admin'
import AdminRecordPicker from './RecordPicker.vue'

const RESULTS: RecordRef[] = [
  { id: 1, label: 'Léa Auteure' },
  { id: 2, label: 'Léo Dessin' },
]

function mountPicker(modelValue: RecordRef | null = null, search = vi.fn(async () => RESULTS)) {
  return {
    search,
    wrapper: mountSuspended(AdminRecordPicker, {
      props: {
        modelValue,
        label: 'Personne',
        placeholder: 'Rechercher…',
        clearLabel: 'Changer',
        search,
      },
    }),
  }
}

describe('AdminRecordPicker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cherche après une courte pause et propose les résultats', async () => {
    const { wrapper: pending, search } = mountPicker()
    const wrapper = await pending

    await wrapper.get('[data-testid="picker-input"]').setValue('lé')
    expect(search).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(search).toHaveBeenCalledWith('lé')
    expect(wrapper.get('[data-testid="picker-results"]').text()).toContain('Léo Dessin')
  })

  it('ne cherche rien pour un texte vide', async () => {
    const { wrapper: pending, search } = mountPicker()
    const wrapper = await pending

    await wrapper.get('[data-testid="picker-input"]').setValue('  ')
    await vi.advanceTimersByTimeAsync(250)

    expect(search).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="picker-results"]').exists()).toBe(false)
  })

  it('choisit un résultat', async () => {
    const wrapper = await mountPicker().wrapper

    await wrapper.get('[data-testid="picker-input"]').setValue('lé')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await wrapper.findAll('.picker__option')[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([RESULTS[0]])
  })

  it('montre le choix fait et permet de le changer', async () => {
    const wrapper = await mountPicker(RESULTS[0]!).wrapper

    expect(wrapper.get('[data-testid="picker-chosen"]').text()).toContain('Léa Auteure')
    await wrapper.get('[data-testid="picker-clear"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null])
  })

  it('écarte la réponse d’une recherche plus lente que la suivante', async () => {
    const resolvers: ((found: RecordRef[]) => void)[] = []
    const slow = vi.fn(() => new Promise<RecordRef[]>((resolve) => resolvers.push(resolve)))
    const wrapper = await mountPicker(null, slow).wrapper

    await wrapper.get('[data-testid="picker-input"]').setValue('lé')
    await vi.advanceTimersByTimeAsync(250)
    await wrapper.get('[data-testid="picker-input"]').setValue('léo')
    await vi.advanceTimersByTimeAsync(250)
    resolvers[1]?.([RESULTS[1]!])
    await flushPromises()
    resolvers[0]?.(RESULTS)
    await flushPromises()

    expect(wrapper.findAll('.picker__option').map((option) => option.text())).toEqual([
      'Léo Dessin',
    ])
  })

  it('n’affiche aucun résultat quand la recherche échoue', async () => {
    const failing = vi.fn(async () => {
      throw new Error('panne')
    })
    const wrapper = await mountPicker(null, failing).wrapper

    await wrapper.get('[data-testid="picker-input"]').setValue('lé')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(wrapper.find('[data-testid="picker-results"]').exists()).toBe(false)
  })
})
