import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { NuxtError } from '#app'
import { describe, expect, it } from 'vitest'
import ErrorPage from './error.vue'

function mountError(statusCode: number) {
  const error = { statusCode, message: 'technique' } as NuxtError
  return mountSuspended(ErrorPage, { props: { error } })
}

describe("page d'erreur", () => {
  it('annonce une page introuvable pour une 404', async () => {
    const wrapper = await mountError(404)

    expect(wrapper.get('h2').text()).toBe("Cette page n'existe pas")
    expect(wrapper.get('[data-testid="not-found"]').text()).toContain('404')
    expect(wrapper.text()).toContain("Retour à l'accueil")
  })

  it('propose le champ de recherche de la maquette sur la 404', async () => {
    const wrapper = await mountError(404)

    const field = wrapper.get('.not-found [role="combobox"]')
    expect(field.attributes('placeholder')).toBe('Rechercher une œuvre, un auteur…')
    expect(wrapper.text()).toContain('Essaie une recherche.')
  })

  it('annonce une erreur générique pour les autres statuts', async () => {
    const wrapper = await mountError(500)

    expect(wrapper.get('h2').text()).toBe('Une erreur est survenue')
  })

  it("ramène à l'accueil depuis le bouton de retour", async () => {
    const wrapper = await mountError(404)

    const backHomeButton = wrapper.findAll('button').find((b) => b.text() === "Retour à l'accueil")
    await backHomeButton!.trigger('click')
    await flushPromises()

    expect(useRouter().currentRoute.value.path).toBe('/')
  })

  it("n'affiche jamais le message technique", async () => {
    const wrapper = await mountError(500)

    expect(wrapper.text()).not.toContain('technique')
  })
})
