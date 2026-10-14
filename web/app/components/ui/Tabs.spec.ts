import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiTabs from './Tabs.vue'

const tabs = [
  { id: 'all', label: 'Toutes', count: 53 },
  { id: 'reading', label: 'En cours', count: 4, status: 'reading' as const },
  { id: 'dropped', label: 'Abandonnées', status: 'dropped' as const },
]

function mountTabs(activeId = 'all') {
  return mountSuspended(UiTabs, { props: { tabs, label: 'Statuts', modelValue: activeId } })
}

describe('UiTabs', () => {
  it("marque l'onglet actif et rend les autres inaccessibles au Tab", async () => {
    const wrapper = await mountTabs('reading')
    const buttons = wrapper.findAll('[role="tab"]')

    expect(buttons.map((button) => button.attributes('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(buttons.map((button) => button.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('affiche les compteurs', async () => {
    const wrapper = await mountTabs()

    expect(wrapper.text()).toContain('53')
    expect(wrapper.text()).toContain('4')
  })

  it("sélectionne l'onglet cliqué", async () => {
    const wrapper = await mountTabs()

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['reading'])
  })

  it("passe à l'onglet voisin avec les flèches", async () => {
    const wrapper = await mountTabs('reading')
    const buttons = wrapper.findAll('[role="tab"]')

    await buttons[1]!.trigger('keydown', { key: 'ArrowRight' })
    await buttons[1]!.trigger('keydown', { key: 'ArrowLeft' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['dropped'], ['all']])
  })

  it('se démonte proprement', async () => {
    const wrapper = await mountTabs()

    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('se parcourt aux flèches, avec retour au début, et Début/Fin', async () => {
    const wrapper = await mountTabs('dropped')
    const buttons = wrapper.findAll('[role="tab"]')

    await buttons[2]!.trigger('keydown', { key: 'ArrowRight' })
    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    await buttons[1]!.trigger('keydown', { key: 'Home' })
    await buttons[1]!.trigger('keydown', { key: 'End' })
    await buttons[1]!.trigger('keydown', { key: 'a' })

    expect(wrapper.emitted('update:modelValue')).toEqual([
      ['all'],
      ['dropped'],
      ['all'],
      ['dropped'],
    ])
  })
})
