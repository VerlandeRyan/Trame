import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '~/utils/auth'
import type { LibraryEntry } from '~/utils/library'
import type { ListedEntry, ListPage, StatusCounts } from '~/utils/reading-list'
import ListPageComponent from './list.vue'

const requests: Record<string, unknown>[] = []
let savedBodies: Record<number, Record<string, unknown>[]> = {}
const deletedIds: number[] = []
let items: ListedEntry[] = []
let total = 0
let failing = false

const queryOf = (path: string) =>
  Object.fromEntries(new URL(path, 'http://localhost').searchParams) as Record<string, unknown>

function listed(id: number, title: string, entry: Partial<LibraryEntry> = {}): ListedEntry {
  return {
    work: {
      id,
      title,
      originalTitle: title,
      originalLanguage: 'fr',
      type: 'series',
      status: 'ongoing',
      formats: ['manga'],
      coverPath: null,
      mainAuthor: null,
      chapters: null,
      volumes: null,
    },
    entry: {
      status: 'reading',
      chaptersRead: 12,
      volumesRead: 2,
      rating: null,
      startedOn: null,
      finishedOn: null,
      ...entry,
    },
  }
}

const COUNTS: StatusCounts = { reading: 2, completed: 0, plan_to_read: 1, on_hold: 0, dropped: 0 }

function registerEntryEndpoints(workId: number) {
  registerEndpoint(`/api/v1/works/${workId}/entry`, {
    method: 'PUT',
    handler: async (event) => {
      const body = (await readBody(event)) as Record<string, unknown>
      savedBodies[workId] = [...(savedBodies[workId] ?? []), body]
      return { entry: { ...items.find((item) => item.work.id === workId)?.entry, ...body } }
    },
  })
  registerEndpoint(`/api/v1/works/${workId}/entry`, {
    method: 'DELETE',
    handler: (event) => {
      deletedIds.push(workId)
      setResponseStatus(event, 204)
      return null
    },
  })
}

beforeEach(() => {
  clearNuxtState()
  // La liste est gardée sous une clé fixe : sans cela un test relit celle du précédent.
  clearNuxtData()
  useState<AuthState>('auth').value = {
    status: 'authenticated',
    user: { id: 1, handle: 'lectrice', role: 'user' },
  }
  useRuntimeConfig().apiBase = ''
  requests.length = 0
  deletedIds.length = 0
  savedBodies = {}
  items = [
    listed(1, 'Aube Fictive'),
    listed(2, 'Basalte', { status: 'plan_to_read', chaptersRead: 0 }),
  ]
  total = 2
  failing = false
  registerEndpoint('/api/v1/me/entries', (event) => {
    const query = queryOf(event.path)
    requests.push(query)
    if (failing) throw createError({ statusCode: 500, data: { code: 'INTERNAL_ERROR' } })
    const page = Number(query.page ?? 1)
    const body: ListPage = {
      items: page === 1 ? items : [listed(3, 'Cap sur les Archipels')],
      page,
      pageSize: 50,
      total,
      statusCounts: COUNTS,
      totals: { chaptersRead: 24, volumesRead: 4 },
    }
    return body
  })
  registerEntryEndpoints(1)
  registerEntryEndpoints(2)
})

const mountList = (path = '/list') => mountSuspended(ListPageComponent, { route: path })

describe('page Ma liste de lecture', () => {
  it('liste les œuvres, les onglets avec leur compteur et les deux totaux séparés', async () => {
    const wrapper = await mountList()

    expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Aube Fictive')
    expect(wrapper.get('[data-testid="list-total-chapters"]').text()).toContain('24')
    expect(wrapper.get('[data-testid="list-total-volumes"]').text()).toContain('4')
    const tabs = wrapper.findAll('[role="tab"]').map((tab) => tab.text())
    expect(tabs[0]).toContain('Tous')
    expect(tabs[0]).toContain('3')
    expect(requests[0]).toMatchObject({ lang: 'fr', sort: 'updated', page: '1', pageSize: '50' })
  })

  it('lit l’onglet, la recherche et le tri dans l’adresse', async () => {
    await mountList('/list?status=reading&q=aube&sort=title')

    expect(requests[0]).toMatchObject({ status: 'reading', q: 'aube', sort: 'title' })
  })

  it('change l’adresse et relit la liste quand on choisit un onglet', async () => {
    const wrapper = await mountList()

    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().startsWith('En cours'))!
      .trigger('click')

    await vi.waitFor(() => expect(requests.at(-1)).toMatchObject({ status: 'reading', page: '1' }))
    expect(useRoute().query).toEqual({ status: 'reading' })
  })

  it('attend la fin de la frappe avant de chercher dans la liste', async () => {
    const wrapper = await mountList()

    await wrapper.get('[data-testid="list-search"]').setValue('aube')

    await vi.waitFor(() => expect(requests.at(-1)).toMatchObject({ q: 'aube' }))
    expect(useRoute().query).toEqual({ q: 'aube' })
  })

  it('change le tri depuis le menu', async () => {
    const wrapper = await mountList()

    await wrapper.get('.select__trigger, [aria-haspopup="listbox"]').trigger('click')
    await wrapper
      .findAll('[role="option"]')
      .find((option) => option.text() === 'Note')!
      .trigger('click')

    await vi.waitFor(() => expect(requests.at(-1)).toMatchObject({ sort: 'rating' }))
    expect(useRoute().query).toEqual({ sort: 'rating' })
  })

  it('affiche la liste vide avec un lien vers le catalogue', async () => {
    items = []
    total = 0
    const emptyCounts = { reading: 0, completed: 0, plan_to_read: 0, on_hold: 0, dropped: 0 }
    registerEndpoint('/api/v1/me/entries', () => ({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      statusCounts: emptyCounts,
      totals: { chaptersRead: 0, volumesRead: 0 },
    }))

    const wrapper = await mountList()

    expect(wrapper.get('[data-testid="list-empty"]').text()).toContain('Ta liste est vide')
    expect(wrapper.get('[data-testid="list-empty"] a').attributes('href')).toBe('/search')
    expect(wrapper.find('[data-testid="list-view-grid"]').exists()).toBe(false)
  })

  it('dit qu’aucune œuvre ne correspond quand un filtre ne garde rien', async () => {
    registerEndpoint('/api/v1/me/entries', () => ({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      statusCounts: COUNTS,
      totals: { chaptersRead: 24, volumesRead: 4 },
    }))

    const wrapper = await mountList('/list?status=dropped')

    expect(wrapper.get('[data-testid="list-no-match"]').text()).toContain('Aucune œuvre')
  })

  it('propose de réessayer quand la liste est indisponible', async () => {
    failing = true

    const wrapper = await mountList()

    expect(wrapper.get('[role="alert"]').text()).toContain('indisponible')
    failing = false
    await wrapper.get('[data-testid="list-retry"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(2))
  })

  it('charge la suite avec le bouton, sans doublon', async () => {
    total = 3
    const wrapper = await mountList()
    expect(wrapper.get('[data-testid="list-more"]').text()).toContain('2 sur 3')

    await wrapper.get('[data-testid="list-load-more"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(3))
    expect(requests.at(-1)).toMatchObject({ page: '2' })
    expect(wrapper.find('[data-testid="list-load-more"]').exists()).toBe(false)
  })

  it('enregistre aussitôt un chapitre de plus et met à jour le total', async () => {
    const wrapper = await mountList()

    await wrapper
      .get('[data-testid="list-row"] [aria-label="Augmenter : Chapitres"]')
      .trigger('click')

    await vi.waitFor(() =>
      expect(savedBodies[1]).toEqual([{ status: 'reading', chaptersRead: 13 }]),
    )
    expect(wrapper.get('[data-testid="list-total-chapters"]').text()).toContain('25')
    expect(wrapper.get('[data-testid="list-total-volumes"]').text()).toContain('4')
  })

  it('demande de commencer une œuvre « À lire » et n’enregistre que sur confirmation', async () => {
    const wrapper = await mountList()
    const secondRow = wrapper.findAll('[data-testid="list-row"]')[1]!

    await secondRow.get('[aria-label="Augmenter : Chapitres"]').trigger('click')
    expect(wrapper.text()).toMatch(/Tu as commencé cette œuvre/)
    expect(savedBodies[2]).toBeUndefined()

    // La confirmation de la page vient après celle de la fenêtre de modification.
    await wrapper.findAll('[data-testid="confirm-accept"]').at(-1)!.trigger('click')
    await vi.waitFor(() => expect(savedBodies[2]).toEqual([{ status: 'reading', chaptersRead: 1 }]))
  })

  describe('passage en « Terminé » avec un total paru connu', () => {
    beforeEach(() => {
      const item = listed(1, 'Aube Fictive', { chaptersRead: 3, volumesRead: 2 })
      items = [{ ...item, work: { ...item.work, chapters: 10, volumes: 2 } }]
      total = 1
    })

    async function chooseCompleted(wrapper: Awaited<ReturnType<typeof mountList>>) {
      await wrapper.get('[data-testid="list-status"]').trigger('click')
      await wrapper.get('[data-testid="list-status-completed"]').trigger('click')
    }

    it('propose de mettre le compteur en dessous au total, l’autre est laissé', async () => {
      const wrapper = await mountList()

      await chooseCompleted(wrapper)
      expect(wrapper.text()).toMatch(/Mettre tes chapitres lus à 10/)
      expect(savedBodies[1]).toBeUndefined()

      await wrapper.findAll('[data-testid="confirm-accept"]').at(-1)!.trigger('click')
      await vi.waitFor(() =>
        expect(savedBodies[1]).toEqual([{ status: 'completed', chaptersRead: 10 }]),
      )
    })

    it('« Garder mes compteurs » enregistre le statut seul', async () => {
      const wrapper = await mountList()

      await chooseCompleted(wrapper)
      await wrapper.findAll('[data-testid="confirm-cancel"]').at(-1)!.trigger('click')

      await vi.waitFor(() => expect(savedBodies[1]).toEqual([{ status: 'completed' }]))
    })
  })

  it('change le statut depuis la ligne', async () => {
    const wrapper = await mountList()
    const firstRow = wrapper.findAll('[data-testid="list-row"]')[0]!

    await firstRow.get('[data-testid="list-status"]').trigger('click')
    await firstRow.get('[data-testid="list-status-on_hold"]').trigger('click')

    await vi.waitFor(() => expect(savedBodies[1]).toEqual([{ status: 'on_hold' }]))
  })

  it('retire une œuvre depuis la fenêtre de modification, après confirmation', async () => {
    const wrapper = await mountList()

    await wrapper.findAll('[data-testid="list-edit"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="list-edit-remove"]').trigger('click')
    await wrapper.findAll('[data-testid="confirm-accept"]')[0]!.trigger('click')

    await vi.waitFor(() => expect(deletedIds).toEqual([1]))
    expect(wrapper.findAll('[data-testid="list-row"]')).toHaveLength(1)
  })

  it('enregistre la modification groupée de la fenêtre', async () => {
    const wrapper = await mountList()

    await wrapper.findAll('[data-testid="list-edit"]')[0]!.trigger('click')
    await wrapper.get('[data-testid="list-edit-rating"]').trigger('click')
    await wrapper.get('[role="option"][data-value="9"]').trigger('click')
    await wrapper.get('[data-testid="list-edit-save"]').trigger('click')

    await vi.waitFor(() => expect(savedBodies[1]).toEqual([{ status: 'reading', rating: 9 }]))
  })

  it('bascule en grille', async () => {
    const wrapper = await mountList('/list?view=grid')

    expect(wrapper.findAll('[data-testid="list-grid-item"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="list-table"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="list-count"]').text()).toBe('2 œuvres')
    expect(wrapper.text()).toContain('Glisser à gauche : +1 chapitre')
  })

  it('fait −1 / +1 sur les tomes quand la grille compte les tomes', async () => {
    const wrapper = await mountList('/list?view=grid')

    await wrapper.get('[data-testid="list-unit-volumes"]').trigger('click')
    expect(wrapper.text()).toContain('Glisser à gauche : +1 tome')
    await wrapper.findAll('[data-testid="list-grid-plus"]')[0]!.trigger('click')

    await vi.waitFor(() => expect(savedBodies[1]).toEqual([{ status: 'reading', volumesRead: 3 }]))
  })
})
