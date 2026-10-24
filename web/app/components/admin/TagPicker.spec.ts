import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminTagPicker from './TagPicker.vue'

const options = [
  { value: 'adventure', label: 'Aventure' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'science_fiction', label: 'Science-fiction' },
  { value: 'slice_of_life', label: 'Tranche de vie' },
]

const mountPicker = (modelValue: string[] = []) =>
  mountSuspended(AdminTagPicker, {
    props: {
      label: 'Genres',
      placeholder: 'Ajouter un genre…',
      emptyLabel: 'Aucun genre trouvé',
      removeLabel: (name: string) => `Retirer ${name}`,
      options,
      modelValue,
    },
  })

const proposals = (wrapper: Awaited<ReturnType<typeof mountPicker>>) =>
  wrapper.findAll('[data-testid="tag-option"]').map((option) => option.text())

describe('AdminTagPicker', () => {
  it('montre les valeurs choisies en pastilles et ne les propose plus', async () => {
    const wrapper = await mountPicker(['fantasy'])

    expect(wrapper.findAll('[data-testid="tag-chosen"]').map((chip) => chip.text())).toEqual([
      'Fantasy',
    ])
    await wrapper.get('[data-testid="tag-input"]').trigger('focus')
    expect(proposals(wrapper)).toEqual(['Aventure', 'Science-fiction', 'Tranche de vie'])
  })

  it('nomme la croix d’une pastille avec le texte fourni', async () => {
    const wrapper = await mountPicker(['fantasy'])

    expect(wrapper.get('[data-testid="tag-chosen"] button').attributes('aria-label')).toBe(
      'Retirer Fantasy',
    )
  })

  it('filtre la liste à la frappe, sans tenir compte des accents ni de la casse', async () => {
    const wrapper = await mountPicker()

    await wrapper.get('[data-testid="tag-input"]').setValue('SCIEN')

    expect(proposals(wrapper)).toEqual(['Science-fiction'])
  })

  it('ajoute la valeur cliquée et vide la recherche', async () => {
    const wrapper = await mountPicker(['fantasy'])
    await wrapper.get('[data-testid="tag-input"]').setValue('tranche')

    await wrapper.get('[data-testid="tag-option"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['fantasy', 'slice_of_life']])
    expect((wrapper.get('[data-testid="tag-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('ajoute le premier résultat avec Entrée, sans envoyer le formulaire', async () => {
    const wrapper = await mountPicker()
    await wrapper.get('[data-testid="tag-input"]').setValue('av')

    await wrapper.get('[data-testid="tag-input"]').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['adventure']])
  })

  it('retire une pastille', async () => {
    const wrapper = await mountPicker(['fantasy', 'adventure'])

    await wrapper.get('[data-testid="tag-chosen"] button').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['adventure']])
  })

  it('borne la hauteur de la liste à la place restante dans la fenêtre', async () => {
    const wrapper = await mountPicker()

    await wrapper.get('[data-testid="tag-input"]').trigger('focus')

    expect(wrapper.get('[data-testid="tag-proposals"]').attributes('style')).toMatch(
      /max-height: \d+px/,
    )
  })

  it('ouvre la liste au-dessus du champ quand le bas de la fenêtre manque de place', async () => {
    const wrapper = await mountPicker()
    const input = wrapper.get('[data-testid="tag-input"]')
    input.element.getBoundingClientRect = () =>
      ({ top: window.innerHeight - 100, bottom: window.innerHeight - 60 }) as DOMRect

    await input.trigger('focus')

    expect(wrapper.get('[data-testid="tag-proposals"]').classes()).toContain(
      'tags__proposals--above',
    )
  })

  it('annonce qu’aucune valeur ne correspond', async () => {
    const wrapper = await mountPicker()

    await wrapper.get('[data-testid="tag-input"]').setValue('zzz')

    expect(wrapper.get('[data-testid="tag-none"]').text()).toBe('Aucun genre trouvé')
  })
})
