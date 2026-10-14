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
})
