import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LibraryEntry } from '~/utils/library'
import type { ListedEntry } from '~/utils/reading-list'
import HomeContinueReading from './ContinueReading.vue'

const READING: LibraryEntry = {
  status: 'reading',
  chaptersRead: 12,
  volumesRead: 0,
  rating: null,
  startedOn: null,
  finishedOn: null,
}

function listed(id: number, entry: Partial<LibraryEntry> = {}, chapters: number | null = null) {
  return {
    work: {
      id,
      title: `Œuvre fictive ${id}`,
      originalTitle: `Œuvre fictive ${id}`,
      originalLanguage: 'fr',
      type: 'series',
      status: 'ongoing',
      formats: ['webtoon'],
      coverPath: null,
      mainAuthor: 'Autrice Inventée',
      chapters,
      volumes: null,
    },
    entry: { ...READING, ...entry },
  } as ListedEntry
}

let saved: unknown[] = []
let saveFails = false

function mountContinueReading(entries: ListedEntry[]) {
  return mountSuspended(HomeContinueReading, { props: { entries } })
}

describe('HomeContinueReading', () => {
  beforeEach(() => {
    useRuntimeConfig().apiBase = ''
    saved = []
    saveFails = false
    for (const id of [1, 2]) {
      registerEndpoint(`/api/v1/works/${id}/entry`, {
        method: 'PUT',
        handler: async (event) => {
          if (saveFails) {
            setResponseStatus(event, 500)
            return { code: 'INTERNAL_ERROR' }
          }
          const body = (await readBody(event)) as Partial<LibraryEntry>
          saved.push(body)
          return { entry: { ...READING, ...body } }
        },
      })
    }
  })

  it('affiche chaque œuvre avec sa progression, son statut et un +1 nommé', async () => {
    const wrapper = await mountContinueReading([
      listed(1),
      listed(2, { chaptersRead: 0, volumesRead: 2 }),
    ])

    const works = wrapper.findAll('[data-testid="continue-reading-work"]')
    expect(works).toHaveLength(2)
    expect(works[0]!.get('[data-testid="continue-reading-progress"]').text()).toBe(
      'Webtoon · Chapitre 12',
    )
    expect(works[0]!.text()).toContain('En cours')
    expect(works[0]!.get('[data-testid="continue-reading-add-one"]').attributes('aria-label')).toBe(
      'Ajouter un chapitre à Œuvre fictive 1',
    )
    expect(works[1]!.get('[data-testid="continue-reading-progress"]').text()).toBe(
      'Webtoon · Tome 2',
    )
    expect(works[1]!.get('[data-testid="continue-reading-add-one"]').attributes('aria-label')).toBe(
      'Ajouter un tome à Œuvre fictive 2',
    )
    expect(wrapper.get('[data-testid="home-continue-reading-list-link"]').attributes('href')).toBe(
      '/list',
    )
  })

  it('+1 enregistre un chapitre de plus et le montre aussitôt', async () => {
    const wrapper = await mountContinueReading([listed(1)])

    await wrapper.get('[data-testid="continue-reading-add-one"]').trigger('click')

    expect(wrapper.get('[data-testid="continue-reading-progress"]').text()).toBe(
      'Webtoon · Chapitre 13',
    )
    await vi.waitFor(() => expect(saved).toEqual([{ status: 'reading', chaptersRead: 13 }]))
  })

  it('+1 compte un tome pour une œuvre suivie par tomes', async () => {
    const wrapper = await mountContinueReading([listed(2, { chaptersRead: 0, volumesRead: 2 })])

    await wrapper.get('[data-testid="continue-reading-add-one"]').trigger('click')

    await vi.waitFor(() => expect(saved).toEqual([{ status: 'reading', volumesRead: 3 }]))
  })

  it("demande confirmation avant de finir l'œuvre, puis la retire de la bande", async () => {
    const wrapper = await mountContinueReading([listed(1, { chaptersRead: 11 }, 12), listed(2)])

    await wrapper.findAll('[data-testid="continue-reading-add-one"]')[0]!.trigger('click')
    expect(saved).toEqual([])
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(saved).toEqual([{ status: 'completed', chaptersRead: 12 }]))
    expect(wrapper.findAll('[data-testid="continue-reading-work"]')).toHaveLength(1)
  })

  it('« Garder » enregistre le chapitre seul, sans finir l’œuvre', async () => {
    const wrapper = await mountContinueReading([listed(1, { chaptersRead: 11 }, 12)])

    await wrapper.get('[data-testid="continue-reading-add-one"]').trigger('click')
    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

    await vi.waitFor(() => expect(saved).toEqual([{ status: 'reading', chaptersRead: 12 }]))
    expect(wrapper.findAll('[data-testid="continue-reading-work"]')).toHaveLength(1)
  })

  it("annonce l'échec et remet la progression d'avant", async () => {
    saveFails = true
    const wrapper = await mountContinueReading([listed(1)])

    await wrapper.get('[data-testid="continue-reading-add-one"]').trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="continue-reading-error"]').exists()).toBe(true),
    )
    expect(wrapper.get('[role="alert"]').text()).toContain("Impossible d'enregistrer")
    expect(wrapper.get('[data-testid="continue-reading-progress"]').text()).toBe(
      'Webtoon · Chapitre 12',
    )
  })
})
