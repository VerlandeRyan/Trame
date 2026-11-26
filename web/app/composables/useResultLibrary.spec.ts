import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchListedWorkIds } from './useResultLibrary'
import { rememberPendingAdd } from '~/utils/pending-add'

let sentBodies: unknown[] = []
let deletes = 0
let failNextWrite = false
let putDelayMs = 0
let serverListed: number[] = []
let listedReads = 0

const SIGNED_IN = {
  status: 'authenticated',
  user: { id: 1, handle: 'lectrice', role: 'user' },
} as const

/** The composable is tested mounted in a component, as in the application. */
async function mountProbe(options: { loaded?: number[] | null; workIds?: number[] } = {}) {
  const loaded = ref<number[] | null | undefined>('loaded' in options ? options.loaded : [])
  const workIds = ref(options.workIds ?? [7])
  const reload = vi.fn()
  const Probe = defineComponent({
    setup: () =>
      useResultLibrary({ loaded: () => loaded.value, workIds: () => [...workIds.value], reload }),
    render: () => h('div'),
  })
  const wrapper = await mountSuspended(Probe)
  return {
    // `vm` exposes the refs already unwrapped.
    library: wrapper.vm as unknown as {
      listed: ReadonlySet<number>
      isListLoaded: boolean
      add: (workId: number) => Promise<void> | undefined
    },
    loaded,
    workIds,
    reload,
  }
}

describe('useResultLibrary', () => {
  beforeEach(() => {
    clearNuxtState()
    window.sessionStorage.clear()
    useRuntimeConfig().apiBase = ''
    useState('auth').value = SIGNED_IN
    sentBodies = []
    deletes = 0
    failNextWrite = false
    putDelayMs = 0
    serverListed = []
    listedReads = 0
    registerEndpoint('/api/v1/works/7/entry', {
      method: 'PUT',
      handler: async (event) => {
        if (failNextWrite) {
          failNextWrite = false
          setResponseStatus(event, 500)
          return { code: 'INTERNAL_ERROR' }
        }
        sentBodies.push(await readBody(event))
        if (putDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, putDelayMs))
        return { entry: { status: 'plan_to_read' } }
      },
    })
    registerEndpoint('/api/v1/works/7/entry', {
      method: 'DELETE',
      handler: (event) => {
        deletes += 1
        setResponseStatus(event, 204)
        return null
      },
    })
    registerEndpoint('/api/v1/me/entries/listed', () => {
      listedReads += 1
      return { workIds: serverListed }
    })
  })

  it('ajoute l’œuvre en « À lire », la montre tout de suite et confirme par un toast', async () => {
    const { library } = await mountProbe()

    const writing = library.add(7)
    expect([...library.listed]).toEqual([7])
    await writing

    expect(sentBodies).toEqual([{ status: 'plan_to_read' }])
    expect([...library.listed]).toEqual([7])
    expect(useToasts().toasts.value).toMatchObject([
      { tone: 'success', messageKey: 'toast.entryAdded' },
    ])
  })

  it('annule un ajout depuis le toast : l’œuvre sort de la liste', async () => {
    const { library } = await mountProbe()
    await library.add(7)

    useToasts().toasts.value[0]?.action?.run()

    expect([...library.listed]).toEqual([])
    await vi.waitFor(() => expect(deletes).toBe(1))
  })

  it('ajoute sans toucher aux autres œuvres de la page', async () => {
    const { library } = await mountProbe({ loaded: [8], workIds: [7, 8] })

    await library.add(7)

    expect([...library.listed].sort((a, b) => a - b)).toEqual([7, 8])
  })

  it('suit la liste lue avec la page', async () => {
    const { library, loaded } = await mountProbe({ loaded: [7] })
    expect([...library.listed]).toEqual([7])

    loaded.value = [8]
    await nextTick()

    expect([...library.listed]).toEqual([8])
  })

  it('garde un ajout en route quand la page est relue entre-temps', async () => {
    putDelayMs = 50
    const { library, loaded } = await mountProbe()

    const writing = library.add(7)
    loaded.value = []
    await nextTick()
    expect([...library.listed]).toEqual([7])
    await writing

    expect([...library.listed]).toEqual([7])
    loaded.value = []
    await nextTick()
    expect([...library.listed]).toEqual([])
  })

  it('relit la liste du serveur après un échec', async () => {
    const { library } = await mountProbe({ loaded: [8], workIds: [7, 8] })
    serverListed = [8, 9]
    failNextWrite = true

    await library.add(7)

    expect(listedReads).toBe(1)
    expect([...library.listed].sort((a, b) => a - b)).toEqual([8, 9])
    expect(useToasts().toasts.value).toMatchObject([{ tone: 'error' }])
  })

  it('ne propose « Ajouter » qu’une fois la liste lue', async () => {
    const { library, loaded } = await mountProbe({ loaded: null })
    expect(library.isListLoaded).toBe(false)

    loaded.value = []
    await nextTick()
    expect(library.isListLoaded).toBe(true)
  })

  it('annonce l’échec de lecture de la liste, avec une relance de la page', async () => {
    const { reload } = await mountProbe({ loaded: null })

    const [toast] = useToasts().toasts.value
    expect(toast).toMatchObject({ tone: 'error' })
    expect(toast?.action?.kind).toBe('retry')
    toast?.action?.run()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('annonce de nouveau l’échec quand la page suivante échoue aussi', async () => {
    const { workIds } = await mountProbe({ loaded: null })
    useToasts().toasts.value.forEach((toast) => useToasts().dismiss(toast.id))
    expect(useToasts().toasts.value).toEqual([])

    workIds.value = [8]
    await nextTick()

    expect(useToasts().toasts.value).toMatchObject([{ tone: 'error' }])
  })

  describe('visiteur', () => {
    beforeEach(() => {
      useState('auth').value = { status: 'anonymous' }
    })

    it('ouvre la connexion et retient l’œuvre, sans rien écrire', async () => {
      const { library } = await mountProbe()

      library.add(7)

      expect(useSignInModal().value).toBe(true)
      expect(window.sessionStorage).toHaveLength(1)
      expect(sentBodies).toEqual([])
    })

    it('oublie l’œuvre quand la fenêtre se ferme sans connexion', async () => {
      const { library } = await mountProbe()
      library.add(7)
      await nextTick()

      useSignInModal().value = false
      await nextTick()

      expect(window.sessionStorage).toHaveLength(0)
    })

    it('n’attend pas de liste lue : sans compte, « Ajouter » est toujours proposé', async () => {
      const { library } = await mountProbe({ loaded: null })
      expect(library.isListLoaded).toBe(true)
    })
  })

  describe('retour après connexion', () => {
    it('ajoute l’œuvre retenue, annonce et permet d’annuler', async () => {
      rememberPendingAdd(7)
      const { library } = await mountProbe({ workIds: [7, 8] })

      await vi.waitFor(() => expect(sentBodies).toEqual([{ status: 'plan_to_read' }]))
      await vi.waitFor(() => expect(useToasts().toasts.value).toHaveLength(1))
      const [toast] = useToasts().toasts.value
      expect(toast).toMatchObject({ tone: 'success', messageKey: 'toast.entryAdded' })
      expect(toast?.action?.kind).toBe('undo')

      toast?.action?.run()
      await vi.waitFor(() => expect(deletes).toBe(1))
      expect([...library.listed]).toEqual([])
    })

    it('ne l’ajoute qu’une fois', async () => {
      rememberPendingAdd(7)
      await mountProbe()
      await vi.waitFor(() => expect(sentBodies).toHaveLength(1))

      await mountProbe()

      expect(sentBodies).toHaveLength(1)
    })

    it.each([
      ['absente de la page', { loaded: [], workIds: [8] }],
      ['déjà dans la liste', { loaded: [7], workIds: [7] }],
    ])('n’ajoute pas une œuvre %s', async (_label, options) => {
      rememberPendingAdd(7)

      await mountProbe(options)
      await nextTick()

      expect(sentBodies).toEqual([])
    })
  })
})

describe('fetchListedWorkIds', () => {
  beforeEach(() => {
    useRuntimeConfig().apiBase = ''
    serverListed = [7]
    listedReads = 0
    registerEndpoint('/api/v1/me/entries/listed', () => {
      listedReads += 1
      return { workIds: serverListed }
    })
  })

  it('lit les œuvres demandées qui sont dans la liste', async () => {
    expect(await fetchListedWorkIds(useApi(), [7, 8])).toEqual([7])
  })

  it('ne fait aucun appel sans œuvre', async () => {
    expect(await fetchListedWorkIds(useApi(), [])).toEqual([])
    expect(listedReads).toBe(0)
  })

  it('rend null quand la lecture échoue', async () => {
    registerEndpoint('/api/v1/me/entries/listed', (event) => {
      setResponseStatus(event, 500)
      return { code: 'INTERNAL_ERROR' }
    })

    expect(await fetchListedWorkIds(useApi(), [7])).toBeNull()
  })
})
