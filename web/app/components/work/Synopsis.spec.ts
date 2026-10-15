import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkSynopsis from './Synopsis.vue'

describe('WorkSynopsis', () => {
  it('affiche le texte, sa langue, sa source et les crédits', async () => {
    const wrapper = await mountSuspended(WorkSynopsis, {
      props: {
        text: 'Un cartographe suit une faille.',
        language: 'fr',
        source: 'official',
        credits: [
          { name: 'Auteur A', roles: ['story'] },
          { name: 'Auteur B', roles: ['art', 'colors'] },
        ],
      },
    })

    expect(wrapper.get('[data-testid="work-synopsis"]').text()).toBe(
      'Un cartographe suit une faille.',
    )
    expect(wrapper.get('[data-testid="work-synopsis"]').attributes('lang')).toBe('fr')
    expect(wrapper.get('[data-testid="work-synopsis-source"]').text()).toContain(
      'synopsis officiel',
    )
    expect(wrapper.get('[data-testid="work-credits"]').text()).toContain('Scénario Auteur A')
    expect(wrapper.get('[data-testid="work-credits"]').text()).toContain('Dessin, Couleur Auteur B')
  })

  it('signale un synopsis traduit automatiquement', async () => {
    const wrapper = await mountSuspended(WorkSynopsis, {
      props: { text: 'Texte.', language: 'en', source: 'machine', credits: [] },
    })

    expect(wrapper.get('[data-testid="work-synopsis-source"]').text()).toContain(
      'traduit automatiquement',
    )
    expect(wrapper.find('[data-testid="work-credits"]').exists()).toBe(false)
  })

  it('affiche le texte en brut, sans interpréter le HTML', async () => {
    const wrapper = await mountSuspended(WorkSynopsis, {
      props: { text: '<img src=x onerror=alert(1)>', language: 'fr', source: 'human', credits: [] },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[data-testid="work-synopsis"]').text()).toBe('<img src=x onerror=alert(1)>')
  })

  it("indique l'absence de synopsis", async () => {
    const wrapper = await mountSuspended(WorkSynopsis, {
      props: { text: null, language: null, source: null, credits: [] },
    })

    expect(wrapper.get('[data-testid="work-synopsis-empty"]').text()).toBe(
      'Pas encore de synopsis.',
    )
  })
})
