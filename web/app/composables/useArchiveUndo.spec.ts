import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { setResponseStatus } from 'h3'
import { afterEach, describe, expect, it } from 'vitest'
import { adminListKey, parseAdminListQuery } from '~/utils/admin'

enableAutoUnmount(afterEach)

const restores: string[] = []
let listReads = 0
let failure: { statusCode: number; code: string } | null = null

registerEndpoint('/api/v1/admin/works/7/restore', {
  method: 'POST',
  handler: (event) => {
    restores.push('restore')
    if (failure) {
      setResponseStatus(event, failure.statusCode)
      return { code: failure.code, message: 'refused' }
    }
    return { id: 7, lifecycle: 'published' }
  },
})

// Le composable se teste monté dans un composant, avec une lecture de la liste à relire.
const Probe = defineComponent({
  async setup() {
    await useAsyncData(adminListKey(parseAdminListQuery({})), () => Promise.resolve(++listReads))
    return { announce: useArchiveUndo() }
  },
  render: () => h('div'),
})

async function mountProbe() {
  const wrapper = await mountSuspended(Probe)
  return wrapper.vm as unknown as { announce: ReturnType<typeof useArchiveUndo> }
}

describe('useArchiveUndo', () => {
  afterEach(() => {
    restores.length = 0
    listReads = 0
    failure = null
    clearNuxtData()
    const { toasts, dismiss } = useToasts()
    for (const toast of [...toasts.value]) dismiss(toast.id)
  })

  it('annonce l’archivage par une réussite qui propose « Annuler »', async () => {
    const { announce } = await mountProbe()
    const { toasts } = useToasts()

    announce('works', 7, true)

    expect(toasts.value).toMatchObject([{ tone: 'success', messageKey: 'toast.recordArchived' }])
    expect(toasts.value[0]?.action?.kind).toBe('undo')
  })

  it('annonce une restauration par une réussite sans « Annuler »', async () => {
    const { announce } = await mountProbe()
    const { toasts } = useToasts()

    announce('works', 7, false)

    expect(toasts.value).toMatchObject([{ tone: 'success', messageKey: 'toast.recordRestored' }])
    expect(toasts.value[0]?.action).toBeUndefined()
  })

  it('restaure la fiche au clic sur « Annuler », l’annonce, puis relit la liste à l’écran', async () => {
    const { announce } = await mountProbe()
    const { toasts, runAction } = useToasts()
    const readsBefore = listReads
    announce('works', 7, true)

    runAction(toasts.value[0]!.id)
    await flushPromises()

    expect(restores).toEqual(['restore'])
    expect(toasts.value).toMatchObject([{ tone: 'success', messageKey: 'toast.recordRestored' }])
    expect(listReads).toBeGreaterThan(readsBefore)
  })

  it('annonce une panne par une erreur qui propose « Réessayer » et rejoue la restauration', async () => {
    const { announce } = await mountProbe()
    const { toasts, runAction } = useToasts()
    announce('works', 7, true)
    failure = { statusCode: 500, code: 'INTERNAL_ERROR' }
    const readsBefore = listReads

    runAction(toasts.value[0]!.id)
    await flushPromises()

    expect(toasts.value).toMatchObject([{ tone: 'error', messageKey: 'writeError.generic' }])
    expect(toasts.value[0]?.action?.kind).toBe('retry')
    expect(listReads).toBe(readsBefore)

    failure = null
    runAction(toasts.value[0]!.id)
    await flushPromises()

    expect(restores).toHaveLength(2)
    expect(toasts.value).toMatchObject([{ tone: 'success', messageKey: 'toast.recordRestored' }])
  })

  it('annonce un refus sans « Réessayer »', async () => {
    const { announce } = await mountProbe()
    const { toasts, runAction } = useToasts()
    announce('works', 7, true)
    failure = { statusCode: 404, code: 'NOT_FOUND' }

    runAction(toasts.value[0]!.id)
    await flushPromises()

    expect(toasts.value[0]).toMatchObject({ tone: 'error' })
    expect(toasts.value[0]?.action).toBeUndefined()
  })
})
