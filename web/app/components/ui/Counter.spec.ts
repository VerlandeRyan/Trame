import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiCounter from './Counter.vue'

function mountCounter(props: { modelValue: number; max?: number; min?: number }) {
  return mountSuspended(UiCounter, { props: { label: 'Chapitres lus', ...props } })
}

describe('UiCounter', () => {
  it("augmente puis diminue d'une unité", async () => {
    const wrapper = await mountCounter({ modelValue: 5 })

    await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')
    await wrapper.get('[aria-label="Diminuer : Chapitres lus"]').trigger('click')

    // 5 → 6 → 5 : le composant garde la valeur courante entre deux clics.
    expect(wrapper.emitted('update:modelValue')).toEqual([[6], [5]])
  })

  it('désactive « moins » au minimum et « plus » au maximum', async () => {
    const atMinimum = await mountCounter({ modelValue: 0 })
    const atMaximum = await mountCounter({ modelValue: 9, max: 9 })

    expect(
      atMinimum.get('[aria-label="Diminuer : Chapitres lus"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      atMaximum.get('[aria-label="Augmenter : Chapitres lus"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('ne garde que les chiffres saisis, dans les bornes', async () => {
    const wrapper = await mountCounter({ modelValue: 5, max: 99 })
    const field = wrapper.get('input')

    await field.setValue('500')
    await field.trigger('change')
    await field.setValue('abc')
    await field.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([[99], [0]])
  })

  it('affiche le libellé vide à la valeur minimale, y compris après une saisie', async () => {
    const wrapper = await mountSuspended(UiCounter, {
      props: { label: 'Ma note', modelValue: 0, max: 10, emptyLabel: '—' },
    })
    const field = wrapper.get('input')
    expect(field.element).toHaveProperty('value', '—')

    await field.setValue('7')
    await field.trigger('change')
    await field.setValue('abc')
    await field.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([[7], [0]])
    expect(field.element).toHaveProperty('value', '—')
  })

  it('réduit la police à partir de quatre chiffres pour que la valeur reste visible', async () => {
    const lengthClass = async (modelValue: number) =>
      (await mountSuspended(UiCounter, { props: { label: 'Chapitres lus', modelValue } }))
        .get('input')
        .classes()

    expect(await lengthClass(999)).toEqual(['counter__value'])
    expect(await lengthClass(1000)).toContain('counter__value--long')
    expect(await lengthClass(10000)).toContain('counter__value--longer')
  })

  it('a des boutons compacts en option', async () => {
    const wrapper = await mountSuspended(UiCounter, {
      props: { label: 'Tomes lus', modelValue: 1, compact: true },
    })

    expect(wrapper.classes()).toContain('counter--compact')
  })
})
