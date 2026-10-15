import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import LayoutHeader from './Header.vue'

describe('LayoutHeader', () => {
  it('présente le logo, la recherche, la langue et la connexion', async () => {
    const wrapper = await mountSuspended(LayoutHeader)

    expect(wrapper.get('header a').text()).toBe('Trame')
    expect(wrapper.text()).toContain('Rechercher une œuvre, un auteur…')
    expect(wrapper.find('button[aria-haspopup]').text()).toBe('FR')
    expect(wrapper.findAll('button').at(-1)?.text()).toBe('Se connecter')
  })
})
