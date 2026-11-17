import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useAutoDismiss } from './useAutoDismiss'

enableAutoUnmount(afterEach)

/** A bare element wired to the composable, as a toast or a banner is. */
function mountHost(durationMs: number, dismiss: () => void) {
  return mountSuspended(
    defineComponent({
      setup() {
        const { isPaused, pauseListeners } = useAutoDismiss(durationMs, dismiss)
        return () =>
          h('div', {
            class: { paused: isPaused.value },
            onPointerenter: pauseListeners.pointerenter,
            onPointerleave: pauseListeners.pointerleave,
            onFocusin: pauseListeners.focusin,
            onFocusout: pauseListeners.focusout,
          })
      },
    }),
  )
}

describe('useAutoDismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('appelle la fermeture une fois le délai écoulé, pas avant', async () => {
    const dismiss = vi.fn()
    await mountHost(5000, dismiss)

    vi.advanceTimersByTime(4999)
    expect(dismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('met le décompte en pause sous la souris et reprend avec le temps restant', async () => {
    const dismiss = vi.fn()
    const wrapper = await mountHost(5000, dismiss)
    vi.advanceTimersByTime(3000)

    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.classes()).toContain('paused')
    vi.advanceTimersByTime(60_000)
    expect(dismiss).not.toHaveBeenCalled()

    await wrapper.trigger('pointerleave')
    expect(wrapper.classes()).not.toContain('paused')
    vi.advanceTimersByTime(1999)
    expect(dismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('ignore le toucher et le stylet : seule la souris met en pause', async () => {
    const dismiss = vi.fn()
    const wrapper = await mountHost(5000, dismiss)

    await wrapper.trigger('pointerenter', { pointerType: 'touch' })
    await wrapper.trigger('pointerenter', { pointerType: 'pen' })
    vi.advanceTimersByTime(5000)

    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('met aussi en pause tant que le focus y est', async () => {
    const dismiss = vi.fn()
    const wrapper = await mountHost(5000, dismiss)

    await wrapper.trigger('focusin')
    vi.advanceTimersByTime(60_000)
    expect(dismiss).not.toHaveBeenCalled()

    await wrapper.trigger('focusout')
    vi.advanceTimersByTime(5000)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('reste en pause tant que la souris ou le focus y sont encore', async () => {
    const dismiss = vi.fn()
    const wrapper = await mountHost(5000, dismiss)

    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.trigger('focusin')
    await wrapper.trigger('pointerleave')
    vi.advanceTimersByTime(60_000)

    expect(dismiss).not.toHaveBeenCalled()
  })

  it('ne se ferme plus une fois démonté, même en pause', async () => {
    const dismiss = vi.fn()
    const wrapper = await mountHost(5000, dismiss)
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })

    wrapper.unmount()
    vi.advanceTimersByTime(60_000)

    expect(dismiss).not.toHaveBeenCalled()
  })
})
