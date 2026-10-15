import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkRelated from './Related.vue'

describe('WorkRelated', () => {
  it('affiche chaque groupe avec son libellé et un lien vers la fiche', async () => {
    const wrapper = await mountSuspended(WorkRelated, {
      props: {
        groups: [
          { key: 'sequel', works: [{ id: 7, title: 'La Suite', type: 'series' }] },
          { key: 'shared_universe', works: [{ id: 9, title: 'Autre Récit', type: 'oneshot' }] },
        ],
      },
    })

    expect(wrapper.get('[data-group="sequel"]').text()).toContain('Suite')
    expect(wrapper.get('[data-group="shared_universe"]').text()).toContain('Même univers')
    // Couvertures seules (maquettes) : le titre est le nom accessible du lien.
    expect(wrapper.get('a[href="/work/7-la-suite"]').attributes('aria-label')).toBe('La Suite')
    expect(wrapper.get('a[href="/work/7-la-suite"]').attributes('title')).toBe('La Suite')
  })

  it("n'affiche rien sans œuvre liée", async () => {
    const wrapper = await mountSuspended(WorkRelated, { props: { groups: [] } })

    expect(wrapper.find('section').exists()).toBe(false)
  })
})
