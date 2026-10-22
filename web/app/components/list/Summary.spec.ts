import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ListSummary from './Summary.vue'

describe('ListSummary', () => {
  it('affiche les chapitres lus et les tomes lus séparément, sans total commun', async () => {
    const wrapper = await mountSuspended(ListSummary, {
      props: { totals: { chaptersRead: 1240, volumesRead: 86 } },
    })

    expect(wrapper.get('[data-testid="list-total-chapters"]').text()).toContain('Chapitres lus')
    expect(wrapper.get('[data-testid="list-total-chapters"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="list-total-volumes"]').text()).toContain('86')
    expect(wrapper.text()).toContain("ne s'additionnent jamais")
    expect(wrapper.text()).not.toContain('1326')
    // Une ligne par total, au mobile : singulier et pluriel.
    expect(wrapper.get('[data-testid="list-totals-line"]').text()).toMatch(
      /chapitres · 86 tomes lus/,
    )
  })

  it('met au singulier un seul chapitre ou tome', async () => {
    const wrapper = await mountSuspended(ListSummary, {
      props: { totals: { chaptersRead: 1, volumesRead: 1 } },
    })

    expect(wrapper.get('[data-testid="list-totals-line"]').text()).toBe('1 chapitre · 1 tome lus')
  })
})
