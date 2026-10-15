import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkPage from './[slug].vue'

const work = {
  id: 42,
  title: 'Ripper',
  originalTitle: 'Ripper',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  synopsis: 'Un récit fictif.',
  synopsisLanguage: 'fr',
  synopsisSource: 'official',
  chapters: null,
  volumes: null,
  startedOn: null,
  endedOn: null,
  coverPath: null,
  alternativeTitles: [{ language: 'en', kind: 'translated', title: 'Work Title' }],
  credits: [{ personId: 1, name: 'Auteur A', kind: 'person', roles: ['story'], links: [] }],
  publishers: [{ id: 1, name: 'Collectif Indé', kind: 'publisher', url: null }],
  formats: ['manga'],
  genres: ['fantasy'],
  links: [{ kind: 'read', url: 'https://lire.test/42', label: null }],
  relations: [
    { relation: 'sequel', direction: 'incoming', work: { id: 7, title: 'Suite', type: 'series' } },
  ],
  memberCount: 2,
  ratingCount: 1,
  ratingAverage: null,
}

beforeEach(() => {
  // Adresse relative : `registerEndpoint` intercepte les appels internes de l'environnement de test.
  useRuntimeConfig().apiBase = ''
  registerEndpoint('/api/v1/works/42', () => work)
  registerEndpoint('/api/v1/works/404', () => {
    throw createError({ statusCode: 404, data: { code: 'NOT_FOUND' } })
  })
})

describe('page de fiche', () => {
  it('affiche la fiche au slug canonique', async () => {
    const wrapper = await mountSuspended(WorkPage, { route: '/work/42-ripper' })

    expect(wrapper.get('[data-testid="work-title"]').text()).toBe('Ripper')
    expect(wrapper.get('[data-testid="work-alternatives"]').text()).toBe('EN : Work Title')
    expect(wrapper.get('[data-testid="work-tags"]').text()).toContain('Manga')
    expect(wrapper.get('[data-testid="work-tags"]').text()).toContain('Fantasy')
    expect(wrapper.get('[data-testid="work-info-publisher"]').text()).toBe('Collectif Indé')
    expect(wrapper.get('[data-testid="work-synopsis"]').text()).toBe('Un récit fictif.')
    expect(wrapper.get('[data-testid="work-read"]').attributes('href')).toBe('https://lire.test/42')
    expect(wrapper.get('[data-testid="work-members"]').text()).toContain('2')
    expect(wrapper.get('[data-group="sequel"]').text()).toContain('Suite')
  })

  it("redirige un slug erroné vers l'URL canonique", async () => {
    await mountSuspended(WorkPage, { route: '/work/42-nimporte-quoi' })

    await vi.waitFor(() => expect(useRoute().path).toBe('/work/42-ripper'))
  })

  it.each(['/work/404-inconnue', '/work/ripper'])(
    'déclenche la page 404 pour %s (œuvre inconnue ou segment invalide)',
    async (route) => {
      clearError()
      // Le rendu de la page interrompue peut lever : seule compte l'erreur fatale enregistrée.
      await mountSuspended(WorkPage, { route }).catch(() => undefined)

      expect(useError().value).toMatchObject({ statusCode: 404 })
      clearError()
    },
  )
})
