import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { setResponseStatus } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminListItem, AdminPage } from '~/utils/admin'
import type { AuthState } from '~/utils/auth'
import CataloguePage from './index.vue'

enableAutoUnmount(afterEach)

const WORKS: AdminPage<AdminListItem> = {
  items: [
    { id: 4, archived: false, title: 'Aube Fictive', type: 'series', status: 'ongoing' },
    { id: 5, archived: true, title: 'Basalte', type: 'oneshot', status: 'completed' },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
}
const ARCHIVES_TOTAL = 12

const requests: { path: string; query: Record<string, string> }[] = []
const writes: string[] = []
let restoreFails = false

beforeEach(() => {
  clearNuxtState()
  clearNuxtData()
  useState<AuthState>('auth').value = {
    status: 'authenticated',
    user: { id: 1, handle: 'ryan', role: 'admin' },
  }
  useRuntimeConfig().apiBase = ''
  requests.length = 0
  writes.length = 0
  restoreFails = false
  for (const kind of ['works', 'people', 'publishers']) {
    registerEndpoint(`/api/v1/admin/${kind}`, (event) => {
      const query = Object.fromEntries(new URL(event.path, 'http://localhost').searchParams)
      requests.push({ path: kind, query })
      if (query.scope === 'archived') return { ...WORKS, total: ARCHIVES_TOTAL }
      return kind === 'works' ? WORKS : { ...WORKS, items: [], total: 0 }
    })
  }
  registerEndpoint('/api/v1/genres', () => ({
    items: [
      { code: 'manga', category: 'format' },
      { code: 'fantasy', category: 'theme' },
    ],
  }))
  registerEndpoint('/api/v1/admin/works/5/restore', {
    method: 'POST',
    handler: (event) => {
      writes.push('restore')
      if (restoreFails) {
        setResponseStatus(event, 403)
        return { code: 'ADMIN_REQUIRED' }
      }
      return { id: 5, archived: false }
    },
  })
})

const mountCatalogue = (path = '/admin/catalogue') => mountSuspended(CataloguePage, { route: path })

describe('page Catalogue d’administration', () => {
  it('liste les œuvres publiées par défaut, avec le lien de création et la barre admin', async () => {
    const wrapper = await mountCatalogue()

    expect(wrapper.findAll('[data-testid="admin-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Aube Fictive')
    expect(wrapper.find('[data-testid="admin-nav-catalogue"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="admin-new"]').attributes('href')).toBe(
      '/admin/catalogue/works/new',
    )
    expect(requests[0]).toMatchObject({
      path: 'works',
      query: { scope: 'active', page: '1', pageSize: '20' },
    })
  })

  it('montre quatre onglets, avec le nombre d’archives', async () => {
    const wrapper = await mountCatalogue()

    const tabs = wrapper.findAll('[role="tab"]').map((tab) => tab.text())
    expect(tabs).toHaveLength(4)
    expect(tabs.slice(0, 3)).toEqual(['Œuvres', 'Personnes', 'Éditeurs et plateformes'])
    expect(tabs[3]).toMatch(new RegExp(`^Archives\\s*${ARCHIVES_TOTAL}$`))
    expect(wrapper.get('[aria-selected="true"]').text()).toBe('Œuvres')
  })

  it('ne demande qu’une fiche pour compter les archives', async () => {
    await mountCatalogue()

    const counting = requests.filter((request) => request.query.scope === 'archived')
    expect(counting).toHaveLength(1)
    expect(counting[0]?.query.pageSize).toBe('1')
  })

  it('envoie les filtres et le tri des œuvres, et montre leur barre', async () => {
    const wrapper = await mountCatalogue(
      '/admin/catalogue?type=oneshot&status=ongoing,completed&format=manga&sort=completeness',
    )

    expect(requests[0]).toMatchObject({
      path: 'works',
      query: {
        type: 'oneshot',
        status: 'ongoing,completed',
        format: 'manga',
        sort: 'completeness',
      },
    })
    expect(wrapper.find('[data-testid="admin-filters"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filter-reset"]').exists()).toBe(true)
  })

  it('ne propose de réinitialiser que si un filtre est actif (le tri n’en est pas un)', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?sort=title_desc')

    expect(wrapper.find('[data-testid="filter-reset"]').exists()).toBe(false)
  })

  it('n’a ni filtres ni tri pour les personnes', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?kind=people&type=oneshot')

    expect(requests[0]!.query).not.toHaveProperty('type')
    expect(requests[0]!.query).not.toHaveProperty('sort')
    expect(wrapper.find('[data-testid="admin-filters"]').exists()).toBe(false)
  })

  it('adapte la recherche et le bouton de création à l’onglet', async () => {
    const works = await mountCatalogue()
    expect(works.get('[data-testid="admin-search"]').attributes('placeholder')).toBe(
      'Rechercher une œuvre ou un auteur…',
    )
    expect(works.get('[data-testid="admin-new"]').text()).toContain('Nouvelle œuvre')

    const people = await mountCatalogue('/admin/catalogue?kind=people')
    expect(people.get('[data-testid="admin-search"]').attributes('placeholder')).toBe(
      'Rechercher une personne…',
    )
    expect(people.get('[data-testid="admin-new"]').text()).toContain('Nouvelle personne')
    expect(people.get('[data-testid="admin-new"]').attributes('href')).toBe(
      '/admin/catalogue/people/new',
    )
  })

  it('chaque onglet repart d’une recherche vide', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?kind=people&q=lea')

    await wrapper.findAll('[role="tab"]')[2]!.trigger('click')

    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.query).toEqual({ kind: 'publishers' }),
    )
  })

  it('masque le bouton de création dans les archives', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?scope=archived')

    expect(wrapper.find('[data-testid="admin-new"]').exists()).toBe(false)
  })

  it('lit l’onglet, la recherche et la page dans l’adresse', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?kind=people&scope=archived&q=lea&page=2')

    expect(requests[0]).toMatchObject({
      path: 'people',
      query: { q: 'lea', scope: 'archived', page: '2' },
    })
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('Archives')
  })

  it('change d’onglet dans l’adresse', async () => {
    const wrapper = await mountCatalogue()

    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')

    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({ kind: 'people' }))
  })

  it('recherche dans le catalogue', async () => {
    const wrapper = await mountCatalogue()

    await wrapper.get('[data-testid="admin-search"]').setValue(' aube ')
    await wrapper.get('form[role="search"]').trigger('submit')

    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({ q: 'aube' }))
  })

  it('affiche un état vide quand rien ne correspond', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?kind=publishers')

    expect(wrapper.find('[data-testid="admin-rows"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Aucune fiche')
  })

  it('restaure une archive, puis relit la liste', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?scope=archived')
    const readsBefore = requests.length

    await wrapper.get('[data-testid="admin-restore"]').trigger('click')
    await flushPromises()

    expect(writes).toEqual(['restore'])
    expect(requests.length).toBeGreaterThan(readsBefore)
  })

  it('archive une œuvre depuis ses actions, après confirmation, puis relit la liste', async () => {
    registerEndpoint('/api/v1/admin/works/4/archive', {
      method: 'POST',
      handler: () => {
        writes.push('archive')
        return { id: 4, archived: true }
      },
    })
    const wrapper = await mountCatalogue()
    const readsBefore = requests.length

    await wrapper.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-menu-archive"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()

    expect(writes).toEqual(['archive'])
    expect(requests.length).toBeGreaterThan(readsBefore)
  })

  it('annonce le refus de l’API', async () => {
    restoreFails = true
    const wrapper = await mountCatalogue('/admin/catalogue?scope=archived')

    await wrapper.get('[data-testid="admin-restore"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('réservée aux administrateurs')
  })
})
