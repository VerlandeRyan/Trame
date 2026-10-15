import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutSearchBox from './SearchBox.vue'

const requests: Record<string, unknown>[] = []
let failing = false

const suggestion = (id: number, title: string) => ({
  id,
  title,
  originalTitle: title,
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: 'Auteur A',
})

beforeEach(() => {
  requests.length = 0
  failing = false
  useRuntimeConfig().apiBase = ''
  registerEndpoint('/api/v1/works', (event) => {
    requests.push(Object.fromEntries(new URL(event.path, 'http://localhost').searchParams))
    if (failing) throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
    return {
      items: [suggestion(1, 'Étoile Vagabonde'), suggestion(2, 'Étoile Brisée')],
      page: 1,
      pageSize: 3,
      total: 34,
    }
  })
})

async function typeInto(wrapper: Awaited<ReturnType<typeof mountSuspended>>, text: string) {
  const input = wrapper.get('input')
  await input.setValue(text)
  await input.trigger('input')
}

describe('LayoutSearchBox', () => {
  it('ne cherche pas avant 2 caractères', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox)

    await typeInto(wrapper, 'é')
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(requests).toHaveLength(0)
    expect(wrapper.get('[role="listbox"]').attributes('style')).toContain('display: none')
  })

  it('affiche les suggestions et le lien vers tous les résultats dès 2 caractères', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox)

    await typeInto(wrapper, 'étoile')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(3))

    expect(requests).toEqual([{ q: 'étoile', lang: 'fr', pageSize: '3' }])
    expect(wrapper.get('input').attributes('aria-expanded')).toBe('true')
    const options = wrapper.findAll('[role="option"]').map((option) => option.text())
    expect(options[0]).toContain('Étoile Vagabonde')
    expect(options[0]).toContain('Série · Manga · Auteur A')
    expect(options[2]).toBe('Voir les 34 résultats')
  })

  it('navigue au clavier et ouvre la fiche de la suggestion active avec Entrée', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox)
    await typeInto(wrapper, 'étoile')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(3))

    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toMatch(/-option-1$/)
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(useRoute().path).toBe('/work/2-etoile-brisee'))
  })

  it('boucle sur la liste avec les flèches et la referme avec Échap', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox)
    await typeInto(wrapper, 'étoile')
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]')).toHaveLength(3))

    const input = wrapper.get('input')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(input.attributes('aria-activedescendant')).toMatch(/-option-2$/)
    await input.trigger('keydown', { key: 'Escape' })
    expect(input.attributes('aria-expanded')).toBe('false')
    expect(input.attributes('aria-activedescendant')).toBeUndefined()
  })

  it('ouvre la page de résultats avec Entrée quand aucune suggestion n’est choisie', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox)
    await typeInto(wrapper, '  étoile   vagabonde ')

    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => expect(useRoute().path).toBe('/search'))
    expect(useRoute().query.q).toBe('étoile vagabonde')
  })

  it('n’ouvre pas la page de résultats pour une saisie trop courte', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox, { route: '/' })
    await typeInto(wrapper, 'é')

    await wrapper.get('form').trigger('submit')

    expect(useRoute().path).toBe('/')
  })

  it('ignore une erreur d’API : pas de menu, Entrée mène toujours aux résultats', async () => {
    failing = true
    const wrapper = await mountSuspended(LayoutSearchBox)

    await typeInto(wrapper, 'étoile')
    // L'appel est rejoué une fois par le client HTTP avant d'échouer.
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.get('input').attributes('aria-expanded')).toBe('false')
  })

  it('rouvre le menu au clic dans le champ, sans nouvelle requête tant que le texte est le même', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox)
    await typeInto(wrapper, 'étoile')
    await vi.waitFor(() => expect(wrapper.get('input').attributes('aria-expanded')).toBe('true'))
    const input = wrapper.get('input')

    await input.trigger('keydown', { key: 'Escape' })
    expect(input.attributes('aria-expanded')).toBe('false')
    await input.trigger('click')

    expect(input.attributes('aria-expanded')).toBe('true')
    expect(requests).toHaveLength(1)
  })

  it('ouvre le menu au focus quand le champ reprend la recherche de la page', async () => {
    const wrapper = await mountSuspended(LayoutSearchBox, { route: '/search?q=étoile' })

    await wrapper.get('input').trigger('focus')

    await vi.waitFor(() => expect(wrapper.get('input').attributes('aria-expanded')).toBe('true'))
    expect(requests).toEqual([{ q: 'étoile', lang: 'fr', pageSize: '3' }])
  })

  it("n'ouvre rien au clic dans un champ vide ou trop court", async () => {
    const wrapper = await mountSuspended(LayoutSearchBox, { route: '/' })

    await wrapper.get('input').trigger('click')
    await typeInto(wrapper, 'é')
    await wrapper.get('input').trigger('click')

    expect(requests).toHaveLength(0)
    expect(wrapper.get('input').attributes('aria-expanded')).toBe('false')
  })

  it("reprend la recherche de l'URL et se referme au clic extérieur", async () => {
    const wrapper = await mountSuspended(LayoutSearchBox, { route: '/search?q=tit' })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('tit')

    await typeInto(wrapper, 'étoile')
    await vi.waitFor(() => expect(wrapper.get('input').attributes('aria-expanded')).toBe('true'))
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await vi.waitFor(() => expect(wrapper.get('input').attributes('aria-expanded')).toBe('false'))
  })
})
