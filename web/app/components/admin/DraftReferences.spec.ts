import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { DraftReference } from '~/utils/admin'
import AdminDraftReferences from './DraftReferences.vue'

const PERSON: DraftReference = { kind: 'people', id: 1, label: 'Aya Morel' }
const WORK: DraftReference = { kind: 'works', id: 4, label: 'Suite' }

describe('AdminDraftReferences', () => {
  it('ne montre rien sans fiche en brouillon', async () => {
    const wrapper = await mountSuspended(AdminDraftReferences, { props: { references: [] } })

    expect(wrapper.find('[data-testid="draft-references"]').exists()).toBe(false)
  })

  it('nomme chaque fiche, son type et un lien qui s’ouvre dans un nouvel onglet', async () => {
    const wrapper = await mountSuspended(AdminDraftReferences, {
      props: { references: [PERSON, WORK] },
    })

    expect(wrapper.get('[role="alert"]').text()).toContain('2 fiches sont encore en brouillon')
    expect(wrapper.text()).toContain("Publie-les d'abord")
    const items = wrapper.findAll('li')
    expect(items.map((item) => item.get('.drafts__kind').text())).toEqual(['Personne ·', 'Œuvre ·'])
    expect(items.map((item) => item.get('a').text())).toEqual(['Aya Morel', 'Suite'])
    const link = items[0]!.get('a')
    expect(link.attributes('href')).toBe('/admin/catalogue/people/1')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.attributes('aria-label')).toBe("Aya Morel (s'ouvre dans un nouvel onglet)")
  })

  it('accorde le message au singulier', async () => {
    const wrapper = await mountSuspended(AdminDraftReferences, { props: { references: [PERSON] } })

    expect(wrapper.get('[role="alert"]').text()).toContain('1 fiche est encore en brouillon')
    expect(wrapper.text()).toContain("Publie-la d'abord")
  })
})
