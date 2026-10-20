import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UnwrapNestedRefs } from 'vue'
import type { LibraryEntry } from '~/utils/library'

const READING: LibraryEntry = {
  status: 'reading',
  chaptersRead: 10,
  volumesRead: 2,
  rating: null,
  startedOn: null,
  finishedOn: null,
}

let stored: LibraryEntry | null = null
let sentBodies: Partial<LibraryEntry>[] = []
let firstSaveDelayMs = 0
let failNextSave = false
let deletes = 0

// Le composable se teste monté dans un composant, comme dans l'application.
const Probe = defineComponent({
  setup: () => useLibraryEntry(7),
  render: () => h('div'),
})

async function mountProbe() {
  const wrapper = await mountSuspended(Probe)
  // `vm` expose les refs déjà déballées.
  return wrapper.vm as unknown as UnwrapNestedRefs<ReturnType<typeof useLibraryEntry>>
}

describe('useLibraryEntry', () => {
  beforeEach(() => {
    // L'entrée et l'état « chargé » vivent dans `useState` : repartir de zéro à chaque test.
    clearNuxtState()
    useRuntimeConfig().apiBase = ''
    stored = null
    sentBodies = []
    firstSaveDelayMs = 0
    failNextSave = false
    deletes = 0
    registerEndpoint('/api/v1/works/7/entry', {
      method: 'GET',
      handler: () => ({ entry: stored }),
    })
    registerEndpoint('/api/v1/works/7/entry', {
      method: 'PUT',
      handler: async (event) => {
        if (failNextSave) {
          failNextSave = false
          setResponseStatus(event, 500)
          return { code: 'INTERNAL_ERROR' }
        }
        const body = (await readBody(event)) as Partial<LibraryEntry>
        const delay = sentBodies.length === 0 ? firstSaveDelayMs : 0
        sentBodies.push(body)
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
        stored = { ...(stored ?? { ...READING, status: 'plan_to_read' }), ...body } as LibraryEntry
        return { entry: stored }
      },
    })
    registerEndpoint('/api/v1/works/7/entry', {
      method: 'DELETE',
      handler: (event) => {
        deletes += 1
        stored = null
        setResponseStatus(event, 204)
        return null
      },
    })
  })

  it('lit l’entrée puis se déclare chargé, même sans entrée', async () => {
    const library = await mountProbe()
    expect(library.isLoaded).toBe(false)

    await library.load()

    expect(library.isLoaded).toBe(true)
    expect(library.entry).toBeNull()
  })

  it('ajoute l’œuvre en « À lire » sans rien d’autre', async () => {
    const library = await mountProbe()

    await library.save({})

    expect(sentBodies).toEqual([{ status: 'plan_to_read' }])
    expect(library.entry?.status).toBe('plan_to_read')
  })

  it('affiche tout de suite le changement et l’envoie dans l’ordre, sans que les réponses se croisent', async () => {
    stored = READING
    firstSaveDelayMs = 40
    const library = await mountProbe()
    await library.load()

    const first = library.save({ volumesRead: 3 })
    expect(library.entry?.volumesRead).toBe(3)
    const second = library.save({ volumesRead: 4 })
    expect(library.entry?.volumesRead).toBe(4)
    await Promise.all([first, second])

    expect(sentBodies).toEqual([
      { status: 'reading', volumesRead: 3 },
      { status: 'reading', volumesRead: 4 },
    ])
    expect(library.entry?.volumesRead).toBe(4)
    expect(library.isBusy).toBe(false)
  })

  it('garde le statut le plus récent quand un autre champ change juste après', async () => {
    stored = READING
    const library = await mountProbe()
    await library.load()

    await Promise.all([library.save({ status: 'completed' }), library.save({ chaptersRead: 11 })])

    expect(sentBodies[1]).toEqual({ status: 'completed', chaptersRead: 11 })
  })

  it('annonce un échec et relit l’entrée du serveur', async () => {
    stored = READING
    const library = await mountProbe()
    await library.load()
    failNextSave = true

    await library.save({ chaptersRead: 99 })

    expect(library.errorKey).toBe('library.error.generic')
    expect(library.entry?.chaptersRead).toBe(10)
  })

  it('retire l’œuvre de la liste', async () => {
    stored = READING
    const library = await mountProbe()
    await library.load()

    await library.remove()

    expect(deletes).toBe(1)
    expect(library.entry).toBeNull()
  })

  it('annonce un échec de lecture et se déclare tout de même chargé', async () => {
    registerEndpoint('/api/v1/works/7/entry', {
      method: 'GET',
      handler: (event) => {
        setResponseStatus(event, 401)
        return { code: 'UNAUTHENTICATED' }
      },
    })
    const library = await mountProbe()

    await library.load()

    expect(library.errorKey).toBe('library.error.signedOut')
    expect(library.isLoaded).toBe(true)
  })
})
