import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ComponentsPage from './components.vue'

describe('galerie de composants', () => {
  it('présente les composants de base avec des données fictives', async () => {
    const wrapper = await mountSuspended(ComponentsPage)

    expect(wrapper.get('h1').text()).toBe('Composants')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(3)
    expect(wrapper.findAll('article')).toHaveLength(3)
    expect(wrapper.text()).toContain('Œuvre fictive A')
  })

  it("change d'onglet et met à jour les compteurs", async () => {
    const wrapper = await mountSuspended(ComponentsPage)

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    await wrapper.get('[aria-label="Augmenter : Chapitres lus"]').trigger('click')

    expect(wrapper.findAll('[role="tab"]')[1]!.attributes('aria-selected')).toBe('true')
    expect((wrapper.get('[aria-label="Chapitres lus"]').element as HTMLInputElement).value).toBe(
      '13',
    )
  })

  it('met à jour le compteur de tomes', async () => {
    const wrapper = await mountSuspended(ComponentsPage)

    await wrapper.get('[aria-label="Augmenter : Tomes lus"]').trigger('click')

    expect((wrapper.get('[aria-label="Tomes lus"]').element as HTMLInputElement).value).toBe('3')
  })

  it('ouvre et ferme la fenêtre modale', async () => {
    const wrapper = await mountSuspended(ComponentsPage)
    const dialog = wrapper.get('dialog').element as HTMLDialogElement

    await wrapper.get('button.btn--secondary').trigger('click')
    expect(dialog.open).toBe(true)

    await wrapper.get('[aria-label="Fermer"]').trigger('click')
    expect(dialog.open).toBe(false)
  })

  it('saisit une recherche dans le champ', async () => {
    const wrapper = await mountSuspended(ComponentsPage)

    await wrapper.get('#gallery-search').setValue('manga')

    expect((wrapper.get('#gallery-search').element as HTMLInputElement).value).toBe('manga')
  })

  it('montre un bouton par statut de lecture', async () => {
    const wrapper = await mountSuspended(ComponentsPage)
    const labels = wrapper.findAll('button').map((button) => button.text())

    for (const status of ['En cours', 'Terminé', 'À lire', 'En pause', 'Abandonné']) {
      expect(labels).toContain(status)
    }
  })
})
