import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ListedWork, ListPage } from '~/utils/reading-list'
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

const requests: Record<string, string>[] = []

beforeEach(() => {
  clearNuxtState()
  clearNuxtData()
  useRuntimeConfig().apiBase = ''
  requests.length = 0
  registerEndpoint('/api/v1/users/lectrice/entries', (event) => {
    requests.push(Object.fromEntries(new URL(event.path, 'http://localhost').searchParams))
    return PAGE
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

  it('montre la grille sans boutons −1 / +1', async () => {
    const wrapper = await mountMemberList('/u/lectrice/list?view=grid')

    expect(wrapper.find('[data-testid="member-list-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="list-grid-plus"]').exists()).toBe(false)
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
