import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { readBody, setResponseStatus, type H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkDraft } from '~/utils/admin'
import type { AuthState } from '~/utils/auth'
import EditPage from './[id].vue'

const PERSON = {
  id: 7,
  name: 'Léa Auteure',
  kind: 'person',
  archived: false,
  activeWorkCount: 0,
  links: [],
}

// Sans cela, une page restée montée relit son état quand le test suivant le vide.
enableAutoUnmount(afterEach)

const sent: { method: string; path: string; body?: unknown }[] = []
let failWith: string | null = null

/** Réponse d'erreur de l'API : le code est dans le corps. */
function rejection(event: H3Event) {
  setResponseStatus(event, 400)
  return { code: failWith }
}

beforeEach(() => {
  clearNuxtState()
  clearNuxtData()
  useState<AuthState>('auth').value = {
    status: 'authenticated',
    user: { id: 1, handle: 'ryan', role: 'admin' },
  }
  useRuntimeConfig().apiBase = ''
  sent.length = 0
  failWith = null
  registerEndpoint('/api/v1/genres', () => ({ items: [{ code: 'manga' }] }))
  registerEndpoint('/api/v1/admin/people/7', {
    method: 'GET',
    handler: () => PERSON,
  })
  registerEndpoint('/api/v1/admin/people/7', {
    method: 'PUT',
    handler: async (event) => {
      sent.push({ method: 'PUT', path: 'people/7', body: await readBody(event) })
      return failWith ? rejection(event) : PERSON
    },
  })
  registerEndpoint('/api/v1/admin/people/7/archive', {
    method: 'POST',
    handler: (event) => {
      sent.push({ method: 'POST', path: 'people/7/archive' })
      return failWith ? rejection(event) : { ...PERSON, archived: true }
    },
  })
  registerEndpoint('/api/v1/admin/works', {
    method: 'POST',
    handler: async (event) => {
      sent.push({ method: 'POST', path: 'works', body: await readBody(event) })
      return failWith ? rejection(event) : { id: 1 }
    },
  })
})

const mountEdit = (path: string) => mountSuspended(EditPage, { route: path })

const WORK_9 = {
  id: 9,
  title: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  archived: false,
  chapters: null,
  volumes: null,
  startedOn: null,
  endedOn: null,
  titles: [],
  synopses: [],
  credits: [],
  publisherIds: [],
  genres: [],
  relations: [
    { relatedWorkId: 11, relation: 'sequel' },
    { relatedWorkId: 12, relation: 'spin_off' },
  ],
  links: [],
  followerCount: 34,
  updatedAt: '2026-10-24T10:00:00.000Z',
}

/** Une œuvre en cours de modification et les deux œuvres qu'elle cite. */
function registerWork9() {
  const related = { id: 11, archived: false, title: 'Suite' }
  registerEndpoint('/api/v1/admin/works/11', () => related)
  registerEndpoint('/api/v1/admin/works/12', () => ({ ...related, id: 12 }))
  registerEndpoint('/api/v1/admin/works/9', { method: 'GET', handler: () => WORK_9 })
}

describe('page d’édition du catalogue', () => {
  it('ramène à la liste où l’on était : onglet, recherche et filtres conservés', async () => {
    useState('admin-last-list').value = parseAdminListQuery({
      kind: 'people',
      q: 'lea',
      page: '2',
    })
    const wrapper = await mountEdit('/admin/catalogue/people/7')

    const expected = '/admin/catalogue?kind=people&q=lea&page=2'
    expect(wrapper.get('[data-testid="admin-back"]').attributes('href')).toBe(expected)
    expect(wrapper.get('[data-testid="admin-cancel"]').attributes('href')).toBe(expected)
  })

  it('à défaut de liste connue, ramène à l’onglet de la fiche', async () => {
    const wrapper = await mountEdit('/admin/catalogue/publishers/new')

    expect(wrapper.get('[data-testid="admin-back"]').attributes('href')).toBe(
      '/admin/catalogue?kind=publishers',
    )
  })

  it('range le titre et son état côte à côte, l’archivage à l’autre bout', async () => {
    const wrapper = await mountEdit('/admin/catalogue/people/7')

    expect(wrapper.get('.edit__heading').text()).toContain('Léa Auteure')
    expect(wrapper.get('.edit__heading [data-testid="admin-state"]').text()).toBe('Publiée')
    expect(wrapper.find('.edit__heading [data-testid="admin-archive"]').exists()).toBe(false)
  })

  it('ouvre un formulaire vide pour une nouvelle œuvre, sans bouton d’archivage', async () => {
    const wrapper = await mountEdit('/admin/catalogue/works/new')

    expect(wrapper.find('[data-testid="work-form"]').exists()).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Nouvelle œuvre')
    expect(wrapper.find('[data-testid="admin-archive"]').exists()).toBe(false)
  })

  it('crée l’œuvre avec le corps attendu puis revient à la liste', async () => {
    const wrapper = await mountEdit('/admin/catalogue/works/new')

    await wrapper.get('#work-title').setValue('Aube Fictive')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(sent[0]).toMatchObject({
      method: 'POST',
      path: 'works',
      body: { title: 'Aube Fictive', originalLanguage: 'fr', status: 'ongoing', chapters: null },
    })
    await vi.waitFor(() => expect(useRouter().currentRoute.value.path).toBe('/admin/catalogue'))
  })

  it('reste sur la fiche et annonce l’erreur quand l’API refuse', async () => {
    failWith = 'VALIDATION_ERROR'
    const wrapper = await mountEdit('/admin/catalogue/works/new')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('ne sont pas valides')
    expect(useRouter().currentRoute.value.path).not.toBe('/admin/catalogue')
  })

  it('charge une personne existante et la remplace', async () => {
    const wrapper = await mountEdit('/admin/catalogue/people/7')

    expect(wrapper.get('h1').text()).toBe('Léa Auteure')
    expect((wrapper.get('#person-name').element as HTMLInputElement).value).toBe('Léa Auteure')

    await wrapper.get('#person-name').setValue('Léa M.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(sent[0]).toMatchObject({ method: 'PUT', body: { name: 'Léa M.', kind: 'person' } })
  })

  it('archive après confirmation', async () => {
    const wrapper = await mountEdit('/admin/catalogue/people/7')

    await wrapper.get('[data-testid="admin-archive"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()

    expect(sent[0]).toMatchObject({ method: 'POST', path: 'people/7/archive' })
    await vi.waitFor(() => expect(useRouter().currentRoute.value.path).toBe('/admin/catalogue'))
  })

  it('repart d’un formulaire vide après une saisie abandonnée', async () => {
    const first = await mountEdit('/admin/catalogue/works/new')
    await first.get('#work-title').setValue('Saisie abandonnée')
    first.unmount()

    const second = await mountEdit('/admin/catalogue/works/new')

    expect((second.get('#work-title').element as HTMLInputElement).value).toBe('')
  })

  it('refuse d’enregistrer une ligne d’auteur sans personne choisie', async () => {
    const wrapper = await mountEdit('/admin/catalogue/works/new')
    useState<WorkDraft>('admin-work-works-new').value.credits.push({ person: null, role: 'art' })
    await wrapper.get('#work-title').setValue('Aube Fictive')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(sent).toEqual([])
    expect(wrapper.get('[role="alert"]').text()).toContain('lignes sont incomplètes')
  })

  it('renvoie la version lue et annonce une fiche modifiée entre-temps', async () => {
    registerWork9()
    registerEndpoint('/api/v1/admin/works/9', {
      method: 'PUT',
      handler: async (event) => {
        sent.push({ method: 'PUT', path: 'works/9', body: await readBody(event) })
        setResponseStatus(event, 409)
        return { code: 'STALE_RECORD' }
      },
    })
    const wrapper = await mountEdit('/admin/catalogue/works/9')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(sent[0]).toMatchObject({ body: { updatedAt: WORK_9.updatedAt } })
    expect(wrapper.get('[role="alert"]').text()).toContain('modifiée depuis que tu')
    expect(useRouter().currentRoute.value.path).toBe('/admin/catalogue/works/9')
  })

  it('demande confirmation avant de quitter avec une saisie non enregistrée', async () => {
    const wrapper = await mountEdit('/admin/catalogue/works/new')
    await wrapper.get('#work-title').setValue('Aube Fictive')
    const router = useRouter()

    await router.push('/admin/catalogue')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/catalogue/works/new')

    const accept = wrapper.get('[data-testid="leave-confirm"] [data-testid="confirm-accept"]')
    expect(accept.classes()).toContain('btn--danger-solid')
    await accept.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/admin/catalogue'))
  })

  it('quitte sans rien demander quand rien n’a changé', async () => {
    await mountEdit('/admin/catalogue/people/7')
    const router = useRouter()

    await router.push('/admin/catalogue')

    expect(router.currentRoute.value.path).toBe('/admin/catalogue')
  })

  it('rappelle dans la confirmation les membres et les relations d’une œuvre', async () => {
    registerWork9()
    const wrapper = await mountEdit('/admin/catalogue/works/9')

    await wrapper.get('[data-testid="admin-archive"]').trigger('click')

    const impact = wrapper.get('[data-testid="admin-archive-impact"]').text()
    expect(impact).toContain('34 membres')
    expect(impact).toContain('2 œuvres liées (conservées)')
  })

  it('n’affiche aucun récapitulatif pour une personne', async () => {
    const wrapper = await mountEdit('/admin/catalogue/people/7')

    expect(wrapper.find('[data-testid="admin-archive-impact"]').exists()).toBe(false)
  })

  it('annonce le refus d’archiver et reste sur la fiche', async () => {
    failWith = 'PERSON_HAS_WORKS'
    const wrapper = await mountEdit('/admin/catalogue/people/7')

    await wrapper.get('[data-testid="admin-archive"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('encore créditée')
  })

  it('ouvre un formulaire d’éditeur', async () => {
    const wrapper = await mountEdit('/admin/catalogue/publishers/new')

    expect(wrapper.find('[data-testid="publisher-form"]').exists()).toBe(true)
  })
})
