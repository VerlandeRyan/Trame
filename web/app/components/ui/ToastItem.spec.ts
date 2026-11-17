import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UiToastItem from './ToastItem.vue'
import type { Toast } from '~/utils/toasts'

enableAutoUnmount(afterEach)

const SUCCESS: Toast = { id: 1, tone: 'success', messageKey: 'auth.signedOut' }
const ERROR: Toast = { id: 2, tone: 'error', messageKey: 'writeError.generic' }

describe('UiToastItem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('se ferme seule après 5 s pour une réussite et 10 s pour une erreur', async () => {
    const success = await mountSuspended(UiToastItem, { props: { toast: SUCCESS } })
    const error = await mountSuspended(UiToastItem, { props: { toast: ERROR } })

    vi.advanceTimersByTime(5000)
    expect(success.emitted('dismiss')).toHaveLength(1)
    expect(error.emitted('dismiss')).toBeUndefined()

    vi.advanceTimersByTime(5000)
    expect(error.emitted('dismiss')).toHaveLength(1)
  })

  it('ne se ferme plus une fois démontée', async () => {
    const wrapper = await mountSuspended(UiToastItem, { props: { toast: SUCCESS } })

    wrapper.unmount()
    vi.advanceTimersByTime(10000)

    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })

  it('met le décompte en pause au survol de la souris et le reprend à la sortie', async () => {
    const wrapper = await mountSuspended(UiToastItem, { props: { toast: SUCCESS } })
    vi.advanceTimersByTime(3000)

    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(60000)
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    expect(wrapper.classes()).toContain('toast--paused')

    await wrapper.trigger('pointerleave')
    vi.advanceTimersByTime(1999)
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('ignore le toucher : seule la souris met en pause', async () => {
    const wrapper = await mountSuspended(UiToastItem, { props: { toast: SUCCESS } })

    await wrapper.trigger('pointerenter', { pointerType: 'touch' })
    vi.advanceTimersByTime(5000)

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('met le décompte en pause tant que le focus est dans l’annonce', async () => {
    const wrapper = await mountSuspended(UiToastItem, {
      props: { toast: { ...ERROR, retry: () => undefined } },
    })

    await wrapper.get('[data-testid="toast-retry"]').trigger('focusin')
    vi.advanceTimersByTime(60000)
    expect(wrapper.emitted('dismiss')).toBeUndefined()

    await wrapper.get('[data-testid="toast-retry"]').trigger('focusout')
    vi.advanceTimersByTime(10000)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
