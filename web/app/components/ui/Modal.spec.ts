import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import UiModal from './Modal.vue'

function mountModal(isOpen: boolean) {
  return mountSuspended(UiModal, {
    props: { title: 'Ajouter', closeLabel: 'Fermer', modelValue: isOpen },
    slots: { default: '<p>Contenu</p>' },
  })
}

describe('UiModal', () => {
  it('affiche le titre et le contenu dans une boîte de dialogue', async () => {
    const wrapper = await mountModal(false)

    expect(wrapper.element.tagName).toBe('DIALOG')
    expect(wrapper.get('h2').text()).toBe('Ajouter')
    expect(wrapper.text()).toContain('Contenu')
  })

  it("s'ouvre et se ferme avec la valeur du modèle", async () => {
    const wrapper = await mountModal(false)
    const dialog = wrapper.element as HTMLDialogElement

    await wrapper.setProps({ modelValue: true })
    expect(dialog.open).toBe(true)

    await wrapper.setProps({ modelValue: false })
    expect(dialog.open).toBe(false)
  })

  it('demande la fermeture depuis le bouton dédié', async () => {
    const wrapper = await mountModal(true)

    await wrapper.get('[aria-label="Fermer"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('demande la fermeture quand le navigateur ferme la boîte (touche Échap)', async () => {
    const wrapper = await mountModal(true)

    await wrapper.trigger('close')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('se ferme au clic sur le voile, pas au clic sur son contenu', async () => {
    const wrapper = await mountModal(true)

    await wrapper.get('p').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // Le clic sur `::backdrop` arrive sur le <dialog> lui-même.
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('est centrée par défaut et peut devenir une feuille basse', async () => {
    const centered = await mountModal(false)
    expect(centered.classes()).toContain('modal--center')

    const sheet = await mountSuspended(UiModal, {
      props: { title: 'Filtres', closeLabel: 'Fermer', modelValue: false, placement: 'bottom' },
    })
    expect(sheet.classes()).toContain('modal--bottom')
  })

  it('affiche le pied seulement quand il est fourni', async () => {
    const without = await mountModal(false)
    expect(without.find('footer').exists()).toBe(false)

    const withFooter = await mountSuspended(UiModal, {
      props: { title: 'Filtres', closeLabel: 'Fermer', modelValue: false },
      slots: { default: '<p>Contenu</p>', footer: '<button>Appliquer</button>' },
    })
    expect(withFooter.get('footer').text()).toBe('Appliquer')
  })
})
