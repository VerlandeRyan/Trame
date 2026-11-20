import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

const Probe = defineComponent({
  setup: () => useConnectionAnnouncements(),
  render: () => h('div'),
})

describe('useConnectionAnnouncements', () => {
  afterEach(() => {
    const { toasts, dismiss } = useToasts()
    for (const toast of [...toasts.value]) dismiss(toast.id)
  })

  it('annonce la perte de connexion par une information durable, retirée au retour du réseau', async () => {
    await mountSuspended(Probe)
    const { toasts } = useToasts()

    window.dispatchEvent(new Event('offline'))
    expect(toasts.value).toMatchObject([
      { tone: 'info', messageKey: 'toast.offline', isSticky: true },
    ])

    window.dispatchEvent(new Event('online'))
    expect(toasts.value).toMatchObject([{ tone: 'success', messageKey: 'toast.backOnline' }])
  })

  it('annonce aussitôt une page ouverte alors que le navigateur est déjà hors connexion', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await mountSuspended(Probe)

    expect(useToasts().toasts.value).toMatchObject([{ tone: 'info', messageKey: 'toast.offline' }])
    onLine.mockRestore()
  })

  it('n’écoute plus une fois la page démontée', async () => {
    const wrapper = await mountSuspended(Probe)

    wrapper.unmount()
    window.dispatchEvent(new Event('offline'))

    expect(useToasts().toasts.value).toEqual([])
  })
})
