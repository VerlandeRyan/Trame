import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkActions from './Actions.vue'

describe('WorkActions', () => {
  it('affiche « Lire » et « Acheter » vers des liens https', async () => {
    const wrapper = await mountSuspended(WorkActions, {
      props: {
        links: [
          { kind: 'read', url: 'https://lire.test/a', label: null },
          { kind: 'buy', url: 'https://acheter.test/a', label: null },
        ],
      },
    })

    expect(wrapper.get('[data-testid="work-read"]').attributes('href')).toBe('https://lire.test/a')
    expect(wrapper.get('[data-testid="work-buy"]').attributes('rel')).toBe('noopener noreferrer')
  })

  it('ignore les liens non sécurisés et les autres natures', async () => {
    const wrapper = await mountSuspended(WorkActions, {
      props: {
        links: [
          { kind: 'read', url: 'http://lire.test/a', label: null },
          { kind: 'website', url: 'https://site.test', label: null },
        ],
      },
    })

    expect(wrapper.find('a').exists()).toBe(false)
  })
})
