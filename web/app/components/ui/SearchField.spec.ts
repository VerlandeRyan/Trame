import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiSearchField from './SearchField.vue'

const mountField = (props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) =>
  mountSuspended(UiSearchField, { props: { label: 'Rechercher', ...props }, attrs })

describe('UiSearchField', () => {
  it('est un champ de recherche nommé par le libellé masqué, avec une loupe décorative', async () => {
    const wrapper = await mountField()

    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('search')
    expect(input.attributes('aria-label')).toBe('Rechercher')
    expect(wrapper.get('.search__icon').attributes('aria-hidden')).toBe('true')
  })

  it("laisse l'appelant relier un libellé visible par l'identifiant", async () => {
    const wrapper = await mountField({ label: undefined }, { id: 'editeur' })

    expect(wrapper.get('input').attributes('id')).toBe('editeur')
    expect(wrapper.get('input').attributes('aria-label')).toBeUndefined()
  })

  it('transmet les attributs natifs au champ, pas au cadre', async () => {
    const wrapper = await mountField(
      {},
      { placeholder: 'Titre', maxlength: '100', 'data-testid': 'list-search' },
    )

    const input = wrapper.get('input')
    expect(input.attributes('placeholder')).toBe('Titre')
    expect(input.attributes('maxlength')).toBe('100')
    expect(input.attributes('data-testid')).toBe('list-search')
    expect(wrapper.get('.search').attributes('data-testid')).toBeUndefined()
  })

  it('donne la classe et le style au cadre, pour que l’appelant le place', async () => {
    const wrapper = await mountField({}, { class: 'list__search', style: 'flex: 1' })

    expect(wrapper.get('.search').classes()).toContain('list__search')
    expect(wrapper.get('.search').attributes('style')).toContain('flex')
    expect(wrapper.get('input').classes()).not.toContain('list__search')
    expect(wrapper.get('input').attributes('style')).toBeUndefined()
  })

  it('émet la valeur saisie puis un évènement « input »', async () => {
    const wrapper = await mountField()

    await wrapper.get('input').setValue('basalte')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['basalte'])
    expect(wrapper.emitted('input')).toHaveLength(1)
  })

  it('affiche la valeur du modèle', async () => {
    const wrapper = await mountField({ modelValue: 'lanternes' })

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('lanternes')
  })

  it('a une variante petite', async () => {
    const wrapper = await mountField({ small: true })

    expect(wrapper.get('.search').classes()).toContain('search--small')
  })

  it('donne le focus au champ', async () => {
    const wrapper = await mountSuspended(UiSearchField, {
      props: { label: 'Rechercher' },
      attachTo: document.body,
    })

    ;(wrapper.vm as unknown as { focus: () => void }).focus()

    expect(document.activeElement).toBe(wrapper.get('input').element)
    wrapper.unmount()
  })

  it('donne la position du cadre, pour placer une liste de propositions dessous', async () => {
    const wrapper = await mountField()

    const rect = (
      wrapper.vm as unknown as { getBoundingClientRect: () => DOMRect }
    ).getBoundingClientRect()

    expect(rect).toHaveProperty('bottom')
  })
})
