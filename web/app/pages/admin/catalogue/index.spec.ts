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
    {
      id: 4,
      lifecycle: 'published',
      title: 'Aube Fictive',
      type: 'series',
      status: 'ongoing',
    },
    { id: 5, lifecycle: 'archived', title: 'Basalte', type: 'oneshot', status: 'completed' },
  ],
  page: 1,
  pageSize: 20,
  total: 2,
}
const ARCHIVES_TOTAL = 12

const requests: { path: string; query: Record<string, string> }[] = []
const writes: string[] = []
/** Code of the error the next restoration answers with, if any. */
let restoreFails: string | null = null
/** Code of the error the next deletion answers with, if any. */
let removeFails: string | null = null
/** Drafts to finish, per kind. */
let draftCounts = { works: 2, people: 1, publishers: 0 }

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
  restoreFails = null
  removeFails = null
  draftCounts = { works: 2, people: 1, publishers: 0 }
  for (const kind of ['works', 'people', 'publishers']) {
    registerEndpoint(`/api/v1/admin/${kind}`, (event) => {
      const query = Object.fromEntries(new URL(event.path, 'http://localhost').searchParams)
      requests.push({ path: kind, query })
      // A later archive page that holds a single row.
      if (query.lifecycle === 'archived' && Number(query.page) > 1)
        return { items: [WORKS.items[1]], page: Number(query.page), pageSize: 20, total: 21 }
      if (query.lifecycle === 'archived' && kind !== 'publishers')
        return { ...WORKS, total: ARCHIVES_TOTAL }
      return kind === 'works' ? WORKS : { ...WORKS, items: [], total: 0 }
    })
  }
  registerEndpoint('/api/v1/admin/draft-counts', () => {
    requests.push({ path: 'draft-counts', query: {} })
    return draftCounts
  })
  registerEndpoint('/api/v1/genres', () => ({
    items: [
      { code: 'manga', category: 'format' },
      { code: 'fantasy', category: 'theme' },
    ],
  }))
  registerEndpoint('/api/v1/admin/works/5', {
    method: 'DELETE',
    handler: (event) => {
      writes.push('remove')
      if (removeFails) {
        setResponseStatus(event, 409)
        return { code: removeFails }
      }
      setResponseStatus(event, 204)
      return null
    },
  })
  registerEndpoint('/api/v1/admin/works/5/restore', {
    method: 'POST',
    handler: (event) => {
      writes.push('restore')
      if (restoreFails) {
        setResponseStatus(event, 500)
        return { code: restoreFails }
      }
      return { id: 5, lifecycle: 'published' }
    },
  })
})

const mountCatalogue = (path = '/admin/catalogue') => mountSuspended(CataloguePage, { route: path })

describe('brouillons du catalogue', () => {
  it('annonce les brouillons de chaque type et ouvre la liste du type choisi', async () => {
    const wrapper = await mountCatalogue()

    const banner = wrapper.get('[data-testid="admin-drafts"]')
    expect(banner.text()).toContain('Brouillons à terminer :')
    expect(wrapper.get('[data-testid="admin-show-drafts-works"]').text()).toBe('2 œuvres')
    expect(wrapper.get('[data-testid="admin-show-drafts-people"]').text()).toBe('1 personne')
    // A kind without draft has no button.
    expect(wrapper.find('[data-testid="admin-show-drafts-publishers"]').exists()).toBe(false)
    // One request for the three counts, not one list per kind.
    expect(requests.filter((request) => request.path === 'draft-counts')).toHaveLength(1)
    expect(requests.some((request) => request.query.lifecycle === 'draft')).toBe(false)

    await wrapper.get('[data-testid="admin-show-drafts-people"]').trigger('click')
    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.query).toEqual({ kind: 'people', lifecycle: 'draft' }),
    )
    await vi.waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.path === 'people' &&
            request.query.lifecycle === 'draft' &&
            request.query.pageSize === '20',
        ),
      ).toBe(true),
    )
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="admin-drafts"]').exists()).toBe(false),
    )
  })

  it('met le message et les types au singulier pour un seul brouillon', async () => {
    draftCounts = { works: 1, people: 0, publishers: 0 }
    const wrapper = await mountCatalogue()

    expect(wrapper.get('[data-testid="admin-drafts"]').text()).toContain('Brouillon à terminer :')
    expect(wrapper.get('[data-testid="admin-show-drafts-works"]').text()).toBe('1 œuvre')
  })

  it('propose le filtre d’état, absent des archives', async () => {
    const wrapper = await mountCatalogue()
    expect(wrapper.find('[data-testid="admin-state-filter"]').exists()).toBe(true)

    const archives = await mountCatalogue('/admin/catalogue?lifecycle=archived')
    expect(archives.find('[data-testid="admin-state-filter"]').exists()).toBe(false)
  })
})

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
      query: { lifecycle: 'active', page: '1', pageSize: '20' },
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

    const counting = requests.filter((request) => request.query.lifecycle === 'archived')
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

  it('n’a que le filtre d’état, ni filtres de type ni tri pour les personnes', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?kind=people&type=oneshot')

    expect(requests[0]!.query).not.toHaveProperty('type')
    expect(requests[0]!.query).not.toHaveProperty('sort')
    expect(wrapper.find('[data-testid="admin-state-filter"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filter-type"]').exists()).toBe(false)
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
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived')

    expect(wrapper.find('[data-testid="admin-new"]').exists()).toBe(false)
  })

  it('lit l’onglet, la recherche et la page dans l’adresse', async () => {
    const wrapper = await mountCatalogue(
      '/admin/catalogue?kind=people&lifecycle=archived&q=lea&page=2',
    )

    expect(requests[0]).toMatchObject({
      path: 'people',
      query: { q: 'lea', lifecycle: 'archived', page: '2' },
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
    expect(wrapper.text()).toContain('« Nouvel éditeur »')
  })

  it("ne renvoie pas vers le bouton d'ajout dans les archives vides", async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived&kind=publishers')

    expect(wrapper.text()).toContain('Aucune fiche')
    expect(wrapper.text()).not.toContain('Nouvel éditeur')
  })

  it('restaure une archive après confirmation, puis relit la liste', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived')
    const readsBefore = requests.length

    await wrapper.get('[data-testid="admin-restore"]').trigger('click')
    expect(writes).toEqual([])
    await wrapper
      .get('[data-testid="restore-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    expect(writes).toEqual(['restore'])
    expect(requests.length).toBeGreaterThan(readsBefore)
  })

  it('archive une œuvre depuis ses actions, après confirmation, puis relit la liste', async () => {
    registerEndpoint('/api/v1/admin/works/4/archive', {
      method: 'POST',
      handler: () => {
        writes.push('archive')
        return { id: 4, lifecycle: 'archived' }
      },
    })
    const wrapper = await mountCatalogue()
    const readsBefore = requests.length

    await wrapper.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-menu-archive"]').trigger('click')
    await wrapper
      .get('[data-testid="archive-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    expect(writes).toEqual(['archive'])
    expect(requests.length).toBeGreaterThan(readsBefore)
  })

  it('supprime définitivement une archive après confirmation, puis relit la liste', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived')
    const readsBefore = requests.length

    await wrapper.findAll('[data-testid="admin-row-menu"]')[1]!.trigger('click')
    await wrapper.get('[data-testid="admin-dropdown-remove"]').trigger('click')
    await wrapper
      .get('[data-testid="remove-archived-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    expect(writes).toEqual(['remove'])
    expect(requests.length).toBeGreaterThan(readsBefore)
  })

  it('revient à la dernière page quand on supprime la dernière ligne de la page 2', async () => {
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived&page=2')
    const readsBefore = requests.length

    await wrapper.get('[data-testid="admin-row-menu"]').trigger('click')
    await wrapper.get('[data-testid="admin-dropdown-remove"]').trigger('click')
    await wrapper
      .get('[data-testid="remove-archived-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    await vi.waitFor(() => expect(useRouter().currentRoute.value.query.page ?? '1').toBe('1'))
    // The empty page 2 is never loaded.
    expect(requests.slice(readsBefore).some((request) => request.query.page === '2')).toBe(false)
  })

  it('explique le refus quand l’archive est encore citée, sans « Réessayer »', async () => {
    removeFails = 'RECORD_IN_USE'
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived')

    await wrapper.findAll('[data-testid="admin-row-menu"]')[1]!.trigger('click')
    await wrapper.get('[data-testid="admin-dropdown-remove"]').trigger('click')
    await wrapper
      .get('[data-testid="remove-archived-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('encore citée par une autre')
    expect(useToasts().toasts.value).toEqual([])
  })

  it('annonce une panne avec « Réessayer », qui rejoue la restauration', async () => {
    restoreFails = 'INTERNAL_ERROR'
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived')

    await wrapper.get('[data-testid="admin-restore"]').trigger('click')
    await wrapper
      .get('[data-testid="restore-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    const toasts = useToasts()
    expect(toasts.toasts.value.at(-1)).toMatchObject({
      tone: 'error',
      messageKey: 'writeError.generic',
      hintKey: 'writeError.retryHint',
    })
    restoreFails = null
    toasts.retry(toasts.toasts.value.at(-1)!.id)
    await flushPromises()

    expect(writes).toEqual(['restore', 'restore'])
  })

  it('montre un refus de l’API au-dessus de la liste, sans « Réessayer »', async () => {
    restoreFails = 'ADMIN_REQUIRED'
    const wrapper = await mountCatalogue('/admin/catalogue?lifecycle=archived')

    await wrapper.get('[data-testid="admin-restore"]').trigger('click')
    await wrapper
      .get('[data-testid="restore-confirm"] [data-testid="confirm-accept"]')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('réservée aux administrateurs')
    expect(useToasts().toasts.value).toEqual([])
  })
})
