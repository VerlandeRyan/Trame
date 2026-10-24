import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AdminRowList from './RowList.vue'

const mountList = (items: string[]) =>
  mountSuspended(AdminRowList, {
    props: { items, addLabel: 'Ajouter', removeLabel: 'Retirer' },
    slots: { default: '<template #default="{ item }"><span>{{ item }}</span></template>' },
  })

describe('AdminRowList', () => {
  it('affiche une ligne par élément avec son contenu', async () => {
    const wrapper = await mountList(['a', 'b'])

    expect(wrapper.findAll('[data-testid="row-list-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('a')
    expect(wrapper.text()).toContain('b')
  })

  it('n’affiche que le bouton d’ajout quand la liste est vide', async () => {
    const wrapper = await mountList([])

    expect(wrapper.find('[data-testid="row-list-row"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="row-list-add"]').text()).toContain('Ajouter')
  })

  it('numérote les lignes en cartes quand un libellé est donné', async () => {
    const wrapper = await mountSuspended(AdminRowList, {
      props: { items: ['a', 'b'], addLabel: 'Ajouter', removeLabel: 'Retirer', rowLabel: 'Titre' },
    })

    const labels = wrapper.findAll('[data-testid="row-list-label"]').map((label) => label.text())
    expect(labels).toEqual(['Titre 1', 'Titre 2'])
  })

  it('n’affiche pas d’en-tête sans libellé', async () => {
    const wrapper = await mountList(['a'])

    expect(wrapper.find('[data-testid="row-list-label"]').exists()).toBe(false)
  })

  it('émet l’ajout et le retrait de la ligne choisie', async () => {
    const wrapper = await mountList(['a', 'b'])

    await wrapper.get('[data-testid="row-list-add"]').trigger('click')
    await wrapper.findAll('[data-testid="row-list-remove"]')[1]!.trigger('click')

    expect(wrapper.emitted('add')).toHaveLength(1)
    expect(wrapper.emitted('remove')?.[0]).toEqual([1])
  })
})
