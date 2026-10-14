import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import LayoutHeader from './Header.vue'

describe('LayoutHeader', () => {
  it('présente le logo, la recherche, la langue et la connexion', async () => {
    const wrapper = await mountSuspended(LayoutHeader)

    expect(wrapper.get('header a').text()).toBe('Trame')
    expect(wrapper.text()).toContain('Rechercher une œuvre, un auteur…')
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.get('button').text()).toBe('Se connecter')
  })
})
