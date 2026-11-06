import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiSegmented from './Segmented.vue'

const options = [
  {
    value: 'chapters',
    label: 'Chapitres',
    icon: 'tabler:bookmark',
    shortLabel: 'Ch.',
    testId: 'c',
  },
  { value: 'volumes', label: 'Tomes', icon: 'tabler:books', shortLabel: 'Tomes', testId: 'v' },
]

const mountSegmented = (modelValue = 'chapters', props: Record<string, unknown> = {}) =>
  mountSuspended(UiSegmented, {
    props: { modelValue, label: 'Compteur affiché', options, ...props },
  })

describe('UiSegmented', () => {
  it('est un groupe de boutons radio natifs nommé par sa légende', async () => {
    const wrapper = await mountSegmented()

    expect(wrapper.get('fieldset legend').text()).toBe('Compteur affiché')
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    expect(new Set(radios.map((radio) => radio.attributes('name'))).size).toBe(1)
  })

  it("coche l'option choisie et nomme chaque bouton par son libellé entier", async () => {
    const wrapper = await mountSegmented('volumes')

    expect((wrapper.get('[data-testid="v"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-testid="c"]').element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.get('[data-testid="c"]').attributes('aria-label')).toBe('Chapitres')
  })

  it("émet la valeur de l'option choisie", async () => {
    const wrapper = await mountSegmented()

    await wrapper.get('[data-testid="v"]').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([['volumes']])
  })

  it('affiche le libellé court au mobile seulement quand il existe, sinon l’icône seule', async () => {
    const wrapper = await mountSegmented('chapters', {
      options: [
        { value: 'list', label: 'Liste', icon: 'tabler:list' },
        { value: 'grid', label: 'Grille', icon: 'tabler:layout-grid' },
      ],
    })

    expect(wrapper.find('.segmented__text--short').exists()).toBe(false)
    expect(wrapper.find('.segmented__icon--desktop-only').exists()).toBe(false)
  })

  it('masque l’icône au mobile quand un libellé court la remplace', async () => {
    const wrapper = await mountSegmented()

    expect(wrapper.get('.segmented__icon').classes()).toContain('segmented__icon--desktop-only')
    expect(wrapper.get('.segmented__text--short').text()).toBe('Ch.')
  })

  it('affiche un préfixe visible sans le lire', async () => {
    const wrapper = await mountSegmented('chapters', { prefix: 'Compter' })

    const prefix = wrapper.get('.segmented__prefix')
    expect(prefix.text()).toBe('Compter')
    expect(prefix.attributes('aria-hidden')).toBe('true')
  })
})
