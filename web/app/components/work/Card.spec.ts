import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkCard from './Card.vue'

describe('WorkCard', () => {
  it('affiche le titre et le type traduit', async () => {
    const wrapper = await mountSuspended(WorkCard, {
      props: { title: 'Œuvre fictive', type: 'oneshot' },
    })

    expect(wrapper.get('h3').text()).toBe('Œuvre fictive')
    expect(wrapper.text()).toContain('One-shot')
  })

  it("transmet l'adresse de la couverture", async () => {
    const wrapper = await mountSuspended(WorkCard, {
      props: { title: 'Œuvre fictive', type: 'series', coverUrl: 'https://exemple.test/c.webp' },
    })

    expect(wrapper.get('img').attributes('src')).toBe('https://exemple.test/c.webp')
  })
})
