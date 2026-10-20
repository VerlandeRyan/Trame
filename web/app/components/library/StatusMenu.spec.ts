import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from '~/utils/library'
import LibraryStatusMenu from './StatusMenu.vue'

const READING: LibraryEntry = {
  status: 'reading',
  chaptersRead: 10,
  volumesRead: 2,
  rating: null,
  startedOn: null,
  finishedOn: null,
}

function mountMenu(props: Partial<InstanceType<typeof LibraryStatusMenu>['$props']> = {}) {
  return mountSuspended(LibraryStatusMenu, {
    props: {
      entry: READING,
      isSignedIn: true,
      isLoaded: true,
      isBusy: false,
      errorKey: null,
      ...props,
    },
    attachTo: document.body,
  })
}

describe('LibraryStatusMenu', () => {
  it('invite un visiteur à se connecter', async () => {
    const wrapper = await mountMenu({ entry: null, isSignedIn: false, isLoaded: false })

    await wrapper.get('[data-testid="library-sign-in"]').trigger('click')

    expect(useSignInModal().value).toBe(true)
    useSignInModal().value = false
  })

  it('ne montre ni « Ajouter » ni statut tant que l’entrée n’est pas lue', async () => {
    const wrapper = await mountMenu({ entry: null, isLoaded: false })

    expect(wrapper.find('[data-testid="library-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="library-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="library-status"]').exists()).toBe(false)
  })

  it('garde le statut affiché pendant qu’on relit l’entrée', async () => {
    const wrapper = await mountMenu({ isLoaded: false })

    expect(wrapper.find('[data-testid="library-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="library-loading"]').exists()).toBe(false)
  })

  it('propose « Ajouter à ma liste » quand l’œuvre n’y est pas, une fois l’entrée lue', async () => {
    const wrapper = await mountMenu({ entry: null })

    await wrapper.get('[data-testid="library-add"]').trigger('click')

    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('montre le statut dans sa couleur, menu fermé', async () => {
    const wrapper = await mountMenu()

    const trigger = wrapper.get('[data-testid="library-status"]')
    expect(trigger.text()).toContain('En cours')
    expect(trigger.classes()).toContain('btn--status-reading')
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('change de statut depuis le menu, sans rien émettre pour le statut courant', async () => {
    const wrapper = await mountMenu()

    await wrapper.get('[data-testid="library-status"]').trigger('click')
    await wrapper.get('[data-testid="library-status-reading"]').trigger('click')
    await wrapper.get('[data-testid="library-status"]').trigger('click')
    await wrapper.get('[data-testid="library-status-completed"]').trigger('click')

    expect(wrapper.emitted('changeStatus')).toEqual([['completed']])
  })

  it('retire l’œuvre seulement après confirmation', async () => {
    const wrapper = await mountMenu()

    await wrapper.get('[data-testid="library-status"]').trigger('click')
    await wrapper.get('[data-testid="library-remove"]').trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('referme le menu avec Échap', async () => {
    const wrapper = await mountMenu()
    await wrapper.get('[data-testid="library-status"]').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.get('[data-testid="library-status"]').attributes('aria-expanded')).toBe('false')
  })

  it('annonce une erreur', async () => {
    const wrapper = await mountMenu({ errorKey: 'library.error.generic' })

    expect(wrapper.get('[role="alert"]').text()).toContain("Impossible d'enregistrer")
  })
})
