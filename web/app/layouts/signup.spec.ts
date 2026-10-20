import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SignupLayout from './signup.vue'

describe("mise en page de l'inscription", () => {
  it('ne montre que le logo, sans recherche ni compte', async () => {
    const wrapper = await mountSuspended(SignupLayout, {
      slots: { default: '<p>Contenu</p>' },
    })

    expect(wrapper.get('header a').text()).toBe('Trame')
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    expect(wrapper.find('header button').exists()).toBe(false)
    expect(wrapper.get('main#contenu').text()).toBe('Contenu')
  })

  it("propose un lien d'évitement vers le contenu", async () => {
    const wrapper = await mountSuspended(SignupLayout)

    expect(wrapper.get('a[href="#contenu"]').text()).toBe('Aller au contenu')
  })
})
