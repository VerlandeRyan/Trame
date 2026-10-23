import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '~/utils/auth'
import type { ListedEntry, ListedWork, ListPage } from '~/utils/reading-list'
import MemberListPage from './list.vue'

const WORK: ListedWork = {
  id: 7,
  title: 'Aube Fictive',
  originalTitle: 'Aube Fictive',
  originalLanguage: 'fr',
  type: 'series',
  status: 'ongoing',
  formats: ['manga'],
  coverPath: null,
  mainAuthor: null,
  chapters: 86,
  volumes: null,
}

const PAGE: ListPage = {
  items: [
    {
      work: WORK,
      entry: {
        status: 'reading',
        chaptersRead: 12,
        volumesRead: 0,
        rating: 8,
        startedOn: null,
        finishedOn: null,
      },
    },
  ],
  page: 1,
  pageSize: 50,
  total: 1,
  statusCounts: { reading: 1, completed: 0, plan_to_read: 0, on_hold: 0, dropped: 0 },
  totals: { chaptersRead: 12, volumesRead: 0 },
}

const SECOND_PAGE_ITEM: ListedEntry = {
  work: { ...WORK, id: 8, title: 'Basalte' },
  entry: { ...PAGE.items[0]!.entry, chaptersRead: 3 },
}

const requests: Record<string, string>[] = []
let total = 1
let failing = false

beforeEach(() => {
  clearNuxtState()
  clearNuxtData()
  useState<AuthState>('auth').value = { status: 'anonymous' }
  useRuntimeConfig().apiBase = ''
  requests.length = 0
  total = 1
  failing = false
  registerEndpoint('/api/v1/users/lectrice/entries', (event) => {
    const query = Object.fromEntries(new URL(event.path, 'http://localhost').searchParams)
    requests.push(query)
    if (failing) throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
    if (query.page === '2') return { ...PAGE, items: [SECOND_PAGE_ITEM], page: 2, total }
    return { ...PAGE, total }
  })
  registerEndpoint('/api/v1/users/discrete/entries', () => {
    throw createError({ statusCode: 403, data: { code: 'PROFILE_PRIVATE' } })
  })
  registerEndpoint('/api/v1/users/inconnue/entries', () => {
    throw createError({ statusCode: 404, data: { code: 'NOT_FOUND' } })
  })
})

const mountMemberList = (path: string) => mountSuspended(MemberListPage, { route: path })

describe('page Liste de lecture d’un membre', () => {
  it('liste ses œuvres en lecture seule, avec le lien de retour au profil', async () => {
    const wrapper = await mountMemberList('/u/lectrice/list')

    expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Aube Fictive')
    expect(wrapper.find('[data-testid="list-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="list-chapters"] input').exists()).toBe(false)
    expect(wrapper.get('[data-testid="member-list-back"]').attributes('href')).toBe('/u/lectrice')
    expect(requests[0]).toMatchObject({ sort: 'updated', page: '1' })
  })

  it('lit l’onglet de statut dans l’adresse', async () => {
    await mountMemberList('/u/lectrice/list?status=reading')

    expect(requests[0]).toMatchObject({ status: 'reading' })
  })

  it('change l’onglet et cherche dans la liste du membre, par l’adresse', async () => {
    const wrapper = await mountMemberList('/u/lectrice/list')

    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().startsWith('En cours'))!
      .trigger('click')
    await vi.waitFor(() => expect(requests.at(-1)).toMatchObject({ status: 'reading' }))

    await wrapper.get('[data-testid="member-list-search"]').setValue('aube')
    await vi.waitFor(() => expect(requests.at(-1)).toMatchObject({ q: 'aube' }))
    expect(useRoute().path).toBe('/u/lectrice/list')
  })

  it('change le tri et la vue par l’adresse', async () => {
    const wrapper = await mountMemberList('/u/lectrice/list')

    await wrapper.get('[data-testid="member-list-sort"]').trigger('click')
    await wrapper
      .findAll('[role="option"]')
      .find((option) => option.text() === 'Note')!
      .trigger('click')
    await vi.waitFor(() => expect(requests.at(-1)).toMatchObject({ sort: 'rating' }))

    await wrapper.get('[data-testid="list-view-grid"]').trigger('click')
    await vi.waitFor(() => expect(useRoute().query).toEqual({ sort: 'rating', view: 'grid' }))
  })

  it('montre la grille sans boutons −1 / +1, en chapitres ou en tomes', async () => {
    const wrapper = await mountMemberList('/u/lectrice/list?view=grid')

    expect(wrapper.find('[data-testid="member-list-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="list-grid-plus"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="list-grid-badge"]').text()).toBe('Ch. 12/86')

    await wrapper.get('[data-testid="list-unit-volumes"]').trigger('click')
    expect(wrapper.get('[data-testid="list-grid-badge"]').text()).toBe('T. 0')
  })

  it('charge la suite avec le bouton', async () => {
    total = 2
    const wrapper = await mountMemberList('/u/lectrice/list')

    await wrapper.get('[data-testid="member-list-load-more"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(2))
    expect(requests.at(-1)).toMatchObject({ page: '2' })
  })

  it('propose de réessayer quand la liste est indisponible', async () => {
    failing = true
    const wrapper = await mountMemberList('/u/lectrice/list')

    expect(wrapper.get('[role="alert"]').text()).toContain('indisponible')
    failing = false
    await wrapper.get('[role="alert"] button').trigger('click')

    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(1))
  })

  it('renvoie son propriétaire vers « Ma liste de lecture », adresse comprise', async () => {
    useState<AuthState>('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'Lectrice', role: 'user' },
    }

    await mountMemberList('/u/lectrice/list?status=reading').catch(() => undefined)

    await vi.waitFor(() => expect(useRoute().fullPath).toBe('/list?status=reading'))
  })

  it('dit qu’un profil privé n’est pas partagé', async () => {
    const wrapper = await mountMemberList('/u/discrete/list')

    expect(wrapper.get('[data-testid="member-list-private"]').text()).toContain(
      'Ce profil est privé',
    )
  })

  it('répond 404 pour un membre inconnu', async () => {
    clearError()
    // Le rendu de la page interrompue peut lever : seule compte l'erreur fatale enregistrée.
    await mountMemberList('/u/inconnue/list').catch(() => undefined)

    expect(useError().value).toMatchObject({ statusCode: 404 })
    clearError()
  })
})
