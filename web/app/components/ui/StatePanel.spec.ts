import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { Icon } from '#components'
import UiStatePanel from './StatePanel.vue'

function iconName(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findComponent(Icon).props('name')
}

describe('UiStatePanel', () => {
  it('affiche le titre, le texte et le contenu additionnel', async () => {
    const wrapper = await mountSuspended(UiStatePanel, {
      props: { title: 'Rien ici', text: 'Revenez plus tard' },
      slots: { default: '<button>Explorer</button>' },
    })

    expect(wrapper.get('h2').text()).toBe('Rien ici')
    expect(wrapper.text()).toContain('Revenez plus tard')
    expect(wrapper.find('button').text()).toBe('Explorer')
  })

  it("n'affiche pas de texte quand il est absent", async () => {
    const wrapper = await mountSuspended(UiStatePanel, { props: { title: 'Rien ici' } })

    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('montre le livre barré par défaut, sans rôle d’alerte', async () => {
    const wrapper = await mountSuspended(UiStatePanel, { props: { title: 'Rien ici' } })

    expect(iconName(wrapper)).toBe('tabler:book-off')
    expect(wrapper.attributes('role')).toBeUndefined()
  })

  it("passe en alerte avec le triangle d'alerte pour une erreur", async () => {
    const wrapper = await mountSuspended(UiStatePanel, {
      props: { title: 'Une erreur est survenue', tone: 'error' },
    })

    expect(iconName(wrapper)).toBe('tabler:alert-triangle')
    expect(wrapper.attributes('role')).toBe('alert')
  })

  it("accepte une autre icône, par exemple le cadenas d'un profil privé", async () => {
    const wrapper = await mountSuspended(UiStatePanel, {
      props: { title: 'Profil privé', icon: 'tabler:lock' },
    })

    expect(iconName(wrapper)).toBe('tabler:lock')
  })

  it('garde la pastille et le titre en version compacte', async () => {
    const wrapper = await mountSuspended(UiStatePanel, {
      props: { title: 'Ta liste est vide', compact: true },
    })

    expect(wrapper.classes()).toContain('state-panel--compact')
    expect(iconName(wrapper)).toBe('tabler:book-off')
    expect(wrapper.get('h2').text()).toBe('Ta liste est vide')
  })

  it("garde les attributs de test de l'appelant", async () => {
    const wrapper = await mountSuspended(UiStatePanel, {
      props: { title: 'Rien' },
      attrs: { 'data-testid': 'list-empty' },
    })

    expect(wrapper.attributes('data-testid')).toBe('list-empty')
  })
})
