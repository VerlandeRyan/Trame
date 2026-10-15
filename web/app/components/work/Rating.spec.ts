import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkRating from './Rating.vue'

describe('WorkRating', () => {
  it('affiche la moyenne, le nombre de notes et les membres', async () => {
    const wrapper = await mountSuspended(WorkRating, {
      props: { average: 7.5, ratingCount: 12, memberCount: 1234 },
    })

    expect(wrapper.get('[data-testid="work-rating"]').text()).toContain('7,5')
    expect(wrapper.get('[data-testid="work-rating"]').text()).toContain('12 notes')
    expect(wrapper.get('[data-testid="work-members"]').text()).toContain('1')
    expect(wrapper.text()).not.toContain('Moyenne affichée dès')
  })

  it('remplace la moyenne par « — » et explique le seuil sous 10 notes', async () => {
    const wrapper = await mountSuspended(WorkRating, {
      props: { average: null, ratingCount: 1, memberCount: 2 },
    })

    expect(wrapper.get('[data-testid="work-rating"]').text()).toContain('—')
    expect(wrapper.get('[data-testid="work-rating"]').text()).toContain('1 note')
    expect(wrapper.text()).toContain('Moyenne affichée dès 10 notes')
  })

  it("affiche « Membres 0 » quand personne n'a l'œuvre", async () => {
    const wrapper = await mountSuspended(WorkRating, {
      props: { average: null, ratingCount: 0, memberCount: 0 },
    })

    expect(wrapper.get('[data-testid="work-members"]').text()).toBe('Membres 0')
  })
})
