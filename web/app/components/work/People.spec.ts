import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import WorkPeople from './People.vue'

function person(id: number, links: { kind: 'social' | 'website'; url: string }[] = []) {
  return {
    personId: id,
    name: `Auteur ${id}`,
    links: links.map((link) => ({ ...link, label: null })),
  }
}

describe('WorkPeople', () => {
  it('affiche les personnes et leurs liens https dans un nouvel onglet protégé', async () => {
    const wrapper = await mountSuspended(WorkPeople, {
      props: {
        people: [
          person(1, [
            { kind: 'social', url: 'https://reseau.test/a' },
            { kind: 'website', url: 'http://non-securise.test' },
            { kind: 'website', url: 'javascript:alert(1)' },
          ]),
        ],
      },
    })

    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]?.attributes('href')).toBe('https://reseau.test/a')
    expect(links[0]?.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.text()).toContain('Auteur 1')
    expect(wrapper.get('h2').text()).toBe('Auteur sur le web')
  })

  it('replie la liste au-delà de 3 personnes puis la déplie', async () => {
    const people = [1, 2, 3, 4, 5].map((id) => person(id))
    const wrapper = await mountSuspended(WorkPeople, { props: { people } })

    expect(wrapper.findAll('li')).toHaveLength(3)
    expect(wrapper.get('h2').text()).toBe('Auteurs sur le web')
    // Le nombre masqué est un texte ; l'action est « Voir tout », à droite de la même ligne.
    expect(wrapper.get('.people__more-label').text()).toBe('+ 2 autres auteurs')
    const toggle = wrapper.get('button')
    expect(toggle.text()).toBe('Voir tout')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')

    expect(wrapper.findAll('li')).toHaveLength(5)
    expect(wrapper.get('button').text()).toBe('Réduire')
    expect(wrapper.find('.people__more-label').exists()).toBe(false)
  })

  it("n'affiche rien sans personne", async () => {
    const wrapper = await mountSuspended(WorkPeople, { props: { people: [] } })

    expect(wrapper.find('section').exists()).toBe(false)
  })
})
