import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import LayoutLanguageSwitcher from './LanguageSwitcher.vue'

describe('LayoutLanguageSwitcher', () => {
  it("propose les langues d'interface et sélectionne la langue courante", async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher)
    const options = wrapper.findAll('option').map((option) => option.text())

    expect(options).toEqual(['FR', 'EN'])
    expect(wrapper.get('select').element.value).toBe('fr')
  })

  it("est étiqueté pour les lecteurs d'écran", async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher)

    expect(wrapper.get('select').attributes('aria-label')).toBe("Langue de l'interface")
  })

  it("change la langue de l'interface", async () => {
    const wrapper = await mountSuspended(LayoutLanguageSwitcher)
    const { $i18n } = useNuxtApp()

    await wrapper.get('select').setValue('en')
    await flushPromises()

    await vi.waitFor(() => expect($i18n.locale.value).toBe('en'))
    await $i18n.setLocale('fr')
  })
})
