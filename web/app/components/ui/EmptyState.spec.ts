import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiEmptyState from './EmptyState.vue'

describe('UiEmptyState', () => {
  it('affiche le titre, le texte et le contenu additionnel', async () => {
    const wrapper = await mountSuspended(UiEmptyState, {
      props: { title: 'Rien ici', text: 'Revenez plus tard' },
      slots: { default: '<button>Explorer</button>' },
    })

    expect(wrapper.get('h2').text()).toBe('Rien ici')
    expect(wrapper.text()).toContain('Revenez plus tard')
    expect(wrapper.find('button').text()).toBe('Explorer')
  })

  it("n'affiche pas de texte quand il est absent", async () => {
    const wrapper = await mountSuspended(UiEmptyState, { props: { title: 'Rien ici' } })

    expect(wrapper.find('p').exists()).toBe(false)
  })
})
