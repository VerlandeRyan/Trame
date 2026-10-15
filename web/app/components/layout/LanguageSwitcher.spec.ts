import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import LayoutLanguageSwitcher from './LanguageSwitcher.vue'

describe('LayoutLanguageSwitcher', () => {
  it('affiche la langue courante dans un bouton étiqueté, menu fermé', async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher)
    const trigger = wrapper.get('button')

    expect(trigger.attributes('aria-label')).toBe("Langue de l'interface")
    expect(trigger.text()).toBe('FR')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect((wrapper.get('ul').element as HTMLElement).style.display).toBe('none')
  })

  it('propose chaque langue sous forme de lien vers la même page', async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher)
    const links = wrapper.findAll('a')

    expect(links.map((link) => link.text())).toEqual(['FrançaisFR', 'EnglishEN'])
    expect(links.map((link) => link.attributes('href'))).toEqual(['/', '/en'])
    expect(links[0]?.attributes('aria-current')).toBe('true')
    expect(links[1]?.attributes('aria-current')).toBeUndefined()
    expect(links[1]?.attributes('hreflang')).toBe('en-GB')
  })

  it('ouvre le menu au clic puis le referme à un second clic', async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher)
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect((wrapper.get('ul').element as HTMLElement).style.display).not.toBe('none')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('se referme avec Échap', async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher, { attachTo: document.body })

    await wrapper.get('button').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('se referme au clic en dehors du menu', async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher, { attachTo: document.body })

    await wrapper.get('button').trigger('click')
    document.body.click()
    await nextTick()

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })
})
