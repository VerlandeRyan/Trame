import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from './app.vue'

describe('application', () => {
  it('affiche la mise en page par défaut autour de la page courante', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })

    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.get('main#contenu').text()).toContain('coups de cœur')
  })
})
