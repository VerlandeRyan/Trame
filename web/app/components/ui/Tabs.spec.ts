import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
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

  it('passe en onglets soulignés à la demande', async () => {
    const wrapper = await mountSuspended(UiTabs, {
      props: { tabs, label: 'Statuts', modelValue: 'all', underline: true },
    })

    expect(wrapper.classes()).toContain('tabs--underline')
    expect((await mountTabs()).classes()).not.toContain('tabs--underline')
  })

  it('signale par des chevrons les onglets soulignés cachés, et les fait défiler', async () => {
    const wrapper = await mountSuspended(UiTabs, {
      props: { tabs, label: 'Statuts', modelValue: 'all', underline: true },
    })
    const tablist = wrapper.get('[role="tablist"]').element as HTMLElement
    Object.defineProperties(tablist, {
      clientWidth: { value: 200, configurable: true },
      scrollWidth: { value: 500, configurable: true },
    })
    const scrollBy = vi.fn()
    tablist.scrollBy = scrollBy

    await wrapper.get('[role="tablist"]').trigger('scroll')

    expect(wrapper.find('.tabs__edge--start').exists()).toBe(false)
    await wrapper.get('.tabs__edge--end button').trigger('click')
    expect(scrollBy).toHaveBeenCalledWith({ left: 120 })
  })

  it('n’affiche pas de chevron hors des onglets soulignés', async () => {
    const wrapper = await mountTabs()

    expect(wrapper.find('.tabs__edge').exists()).toBe(false)
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
