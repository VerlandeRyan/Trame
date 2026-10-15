import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiSelect from './Select.vue'

const options = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'title', label: 'Titre (A → Z)' },
  { value: 'recent', label: 'Plus récentes' },
]

function mountSelect(modelValue = 'relevance') {
  return mountSuspended(UiSelect, {
    props: { modelValue, options, label: 'Trier par', triggerTestId: 'sort' },
    attachTo: document.body,
  })
}

describe('UiSelect', () => {
  it('affiche le préfixe, la valeur courante et un menu fermé', async () => {
    const wrapper = await mountSelect()

    expect(wrapper.get('.select__prefix').text()).toBe('Trier par')
    const trigger = wrapper.get('[data-testid="sort"]')
    expect(trigger.text()).toBe('Pertinence')
    expect(trigger.attributes('aria-label')).toBe('Trier par : Pertinence')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[role="listbox"]').attributes('style')).toContain('display: none')
  })

  it('ouvre le menu au clic et coche la valeur choisie', async () => {
    const wrapper = await mountSelect('title')

    await wrapper.get('[data-testid="sort"]').trigger('click')

    expect(wrapper.get('[data-testid="sort"]').attributes('aria-expanded')).toBe('true')
    const items = wrapper.findAll('[role="option"]')
    expect(items.map((item) => item.text())).toEqual([
      'Pertinence',
      'Titre (A → Z)',
      'Plus récentes',
    ])
    expect(items.map((item) => item.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
  })

  it('émet la valeur cliquée et referme le menu', async () => {
    const wrapper = await mountSelect()
    await wrapper.get('[data-testid="sort"]').trigger('click')

    await wrapper.findAll('[role="option"]')[2]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['recent']])
    expect(wrapper.get('[data-testid="sort"]').attributes('aria-expanded')).toBe('false')
  })

  it('se pilote au clavier : flèches, Entrée, Échap', async () => {
    const wrapper = await mountSelect()
    const trigger = wrapper.get('[data-testid="sort"]')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    // L'option active est annoncée depuis le bouton, qui garde le focus.
    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-1$/)
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['title']])

    await trigger.trigger('keydown', { key: 'ArrowUp' })
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await trigger.trigger('keydown', { key: 'Escape' })
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('boucle sur la liste avec les flèches', async () => {
    const wrapper = await mountSelect()
    const trigger = wrapper.get('[data-testid="sort"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })

    await trigger.trigger('keydown', { key: 'ArrowUp' })

    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-2$/)
  })

  it('va au début et à la fin avec Début et Fin', async () => {
    const wrapper = await mountSelect('title')
    const trigger = wrapper.get('[data-testid="sort"]')

    await trigger.trigger('keydown', { key: 'End' })
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-2$/)

    await trigger.trigger('keydown', { key: 'Home' })
    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-0$/)
  })

  it('saute à l’option dont le libellé commence par la lettre tapée', async () => {
    const wrapper = await mountSelect()
    const trigger = wrapper.get('[data-testid="sort"]')

    await trigger.trigger('keydown', { key: 't' })
    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-1$/)

    // Une lettre sans option correspondante ne bouge rien.
    await trigger.trigger('keydown', { key: 'z' })
    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-1$/)

    await trigger.trigger('keydown', { key: 'p' })
    expect(trigger.attributes('aria-activedescendant')).toMatch(/-option-2$/)
  })

  it('se referme avec Tab et au clic extérieur', async () => {
    const wrapper = await mountSelect()
    const trigger = wrapper.get('[data-testid="sort"]')

    await trigger.trigger('click')
    await trigger.trigger('keydown', { key: 'Tab' })
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })
})
