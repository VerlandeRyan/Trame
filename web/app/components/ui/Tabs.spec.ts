import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  describe('pastille sur un chevron', () => {
    const alertedTabs = [
      { id: 'one', label: 'Un', alert: 'À corriger' },
      { id: 'two', label: 'Deux' },
      { id: 'three', label: 'Trois', alert: 'À corriger' },
    ]

    afterEach(() => vi.restoreAllMocks())

    /**
     * Fakes the layout of tabs 150 px wide in a 200 px bar scrolled to `scrollLeft`: the bar's
     * rectangle, and each alert dot (9 px wide, 16 px before the right end of its tab).
     */
    function fakeLayout(scrollLeft: number) {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const tab = this.closest('[role="tab"]')
        const index = tab
          ? [...tab.parentElement!.querySelectorAll('[role="tab"]')].indexOf(tab)
          : 0
        const left = tab ? index * 150 + 150 - 16 - 9 - scrollLeft : 0
        const rect = tab ? { left, right: left + 9 } : { left: 0, right: 200 }
        return { ...rect, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect
      })
    }

    /** Mounts underlined tabs in a bar scrolled to `scrollLeft`. */
    async function mountScrolled(scrollLeft: number, tabsProp = alertedTabs) {
      fakeLayout(scrollLeft)
      const wrapper = await mountSuspended(UiTabs, {
        props: { tabs: tabsProp, label: 'Sections', modelValue: 'two', underline: true },
      })
      const tablist = wrapper.get('[role="tablist"]').element as HTMLElement
      Object.defineProperties(tablist, {
        clientWidth: { value: 200, configurable: true },
        scrollWidth: { value: 450, configurable: true },
        scrollLeft: { value: scrollLeft, configurable: true },
      })
      await wrapper.get('[role="tablist"]').trigger('scroll')
      return wrapper
    }

    it('marque le chevron du côté où un onglet signalé est caché', async () => {
      const wrapper = await mountScrolled(0)

      expect(wrapper.find('.tabs__edge--start').exists()).toBe(false)
      expect(wrapper.find('.tabs__edge--end .tabs__arrow-alert').exists()).toBe(true)
    })

    it('marque les deux chevrons quand des onglets signalés sont cachés des deux côtés', async () => {
      const wrapper = await mountScrolled(150)

      expect(wrapper.find('.tabs__edge--start .tabs__arrow-alert').exists()).toBe(true)
      expect(wrapper.find('.tabs__edge--end .tabs__arrow-alert').exists()).toBe(true)
    })

    it('ne marque pas un chevron dont les onglets cachés ne sont pas signalés', async () => {
      const wrapper = await mountScrolled(0, [
        alertedTabs[0]!,
        alertedTabs[1]!,
        { ...alertedTabs[2]!, alert: undefined },
      ])

      expect(wrapper.find('.tabs__edge--end').exists()).toBe(true)
      expect(wrapper.find('.tabs__arrow-alert').exists()).toBe(false)
    })

    it('cache la pastille aux lecteurs d’écran, comme le chevron', async () => {
      const wrapper = await mountScrolled(0)

      expect(wrapper.get('.tabs__edge--end .tabs__arrow').attributes('aria-hidden')).toBe('true')
    })

    it('met la pastille à jour quand une alerte apparaît sans défilement', async () => {
      const wrapper = await mountScrolled(
        0,
        alertedTabs.map(({ id, label }) => ({ id, label })),
      )
      expect(wrapper.find('.tabs__arrow-alert').exists()).toBe(false)

      await wrapper.setProps({ tabs: alertedTabs })

      expect(wrapper.find('.tabs__edge--end .tabs__arrow-alert').exists()).toBe(true)
    })

    it('remesure quand un libellé change, sans défilement', async () => {
      const wrapper = await mountScrolled(0)
      const measure = vi.mocked(Element.prototype.getBoundingClientRect)
      measure.mockClear()

      await wrapper.setProps({
        tabs: alertedTabs.map((tab) => ({ ...tab, label: `${tab.label} !` })),
      })

      expect(measure).toHaveBeenCalled()
    })

    it('ne remesure pas quand le parent recrée les mêmes onglets', async () => {
      const wrapper = await mountScrolled(0)
      const measure = vi.mocked(Element.prototype.getBoundingClientRect)
      measure.mockClear()

      await wrapper.setProps({ tabs: alertedTabs.map((tab) => ({ ...tab })) })

      expect(measure).not.toHaveBeenCalled()
    })
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

  it('signale par un point rouge, avec son texte, un onglet qui a une alerte', async () => {
    const wrapper = await mountSuspended(UiTabs, {
      props: {
        tabs: [...tabs.slice(0, 2), { id: 'bad', label: 'Liens', alert: 'Ligne incomplète' }],
        label: 'Statuts',
        modelValue: 'all',
      },
    })

    const alerts = wrapper.findAll('.tabs__alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.attributes('role')).toBe('img')
    expect(alerts[0]!.attributes('aria-label')).toBe('Ligne incomplète')
    expect(wrapper.findAll('[role="tab"]')[2]!.find('.tabs__alert').exists()).toBe(true)
  })
})
