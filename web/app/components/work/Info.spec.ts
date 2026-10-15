import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkInfo from './Info.vue'

const baseProps = {
  type: 'series' as const,
  formats: ['manga'],
  totals: { chapters: null, volumes: null },
  status: 'ongoing' as const,
  publishers: ['Collectif Indé'],
  originalLanguage: 'fr',
}

describe('WorkInfo', () => {
  it('affiche « ? » pour les totaux inconnus et les libellés traduits', async () => {
    const wrapper = await mountSuspended(WorkInfo, { props: baseProps })

    expect(wrapper.get('[data-testid="work-info-type"]').text()).toBe('Série')
    expect(wrapper.get('[data-testid="work-info-format"]').text()).toBe('Manga')
    expect(wrapper.get('[data-testid="work-info-chapters"]').text()).toBe('?')
    expect(wrapper.get('[data-testid="work-info-volumes"]').text()).toBe('?')
    expect(wrapper.get('[data-testid="work-info-status"]').text()).toBe('En cours')
    expect(wrapper.get('[data-testid="work-info-publisher"]').text()).toBe('Collectif Indé')
    expect(wrapper.get('[data-testid="work-info-language"]').text().toLowerCase()).toBe('français')
  })

  it('affiche les totaux connus et omet les lignes vides', async () => {
    const wrapper = await mountSuspended(WorkInfo, {
      props: {
        ...baseProps,
        formats: [],
        publishers: [],
        totals: { chapters: 158, volumes: 4 },
        status: 'completed',
      },
    })

    expect(wrapper.get('[data-testid="work-info-chapters"]').text()).toBe('158')
    expect(wrapper.get('[data-testid="work-info-volumes"]').text()).toBe('4')
    expect(wrapper.find('[data-testid="work-info-format"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="work-info-publisher"]').exists()).toBe(false)
  })

  it('se replie et se déplie par le bouton du titre (mobile)', async () => {
    const wrapper = await mountSuspended(WorkInfo, { props: baseProps })
    const toggle = wrapper.get('button')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('section').classes()).not.toContain('info--collapsed')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('section').classes()).toContain('info--collapsed')
    expect(toggle.attributes('aria-controls')).toBe(wrapper.get('dl').attributes('id'))

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it("garde le code d'un format inconnu et la langue brute si elle est invalide", async () => {
    const wrapper = await mountSuspended(WorkInfo, {
      props: { ...baseProps, formats: ['zine'], originalLanguage: 'not a language' },
    })

    expect(wrapper.get('[data-testid="work-info-format"]').text()).toBe('zine')
    expect(wrapper.get('[data-testid="work-info-language"]').text()).toBe('not a language')
  })
})
