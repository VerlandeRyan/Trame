import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminPanel from './Panel.vue'

const mountPanel = (props: { title: string; hint?: string }) =>
  mountSuspended(AdminPanel, { props, slots: { default: '<p>Contenu</p>' } })

describe('AdminPanel', () => {
  it('affiche le titre, l’aide et le contenu, la section porte le titre', async () => {
    const wrapper = await mountPanel({ title: 'Synopsis', hint: 'Un résumé par langue.' })

    const heading = wrapper.get('h2')
    expect(heading.text()).toBe('Synopsis')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(wrapper.text()).toContain('Un résumé par langue.')
    expect(wrapper.text()).toContain('Contenu')
  })

  it('n’affiche pas d’aide quand il n’y en a pas', async () => {
    const wrapper = await mountPanel({ title: 'Liens' })

    expect(wrapper.find('.panel__hint').exists()).toBe(false)
  })
})
