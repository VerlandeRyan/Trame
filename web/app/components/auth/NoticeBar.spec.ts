import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthNoticeBar from './NoticeBar.vue'
import type { AuthNotice } from '~/utils/auth'

enableAutoUnmount(afterEach)

const SUCCESS: AuthNotice = { key: 'auth.signedOut', tone: 'success' }
const ERROR: AuthNotice = { key: 'auth.signOutFailed', tone: 'error' }

describe('AuthNoticeBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('se ferme seul après 5 s pour une réussite et 10 s pour une erreur', async () => {
    const success = await mountSuspended(AuthNoticeBar, { props: { notice: SUCCESS } })
    const error = await mountSuspended(AuthNoticeBar, { props: { notice: ERROR } })

    vi.advanceTimersByTime(5000)
    expect(success.emitted('dismiss')).toHaveLength(1)
    expect(error.emitted('dismiss')).toBeUndefined()

    vi.advanceTimersByTime(5000)
    expect(error.emitted('dismiss')).toHaveLength(1)
  })

  it('annonce la durée du décompte à la barre', async () => {
    const wrapper = await mountSuspended(AuthNoticeBar, { props: { notice: SUCCESS } })

    expect(wrapper.attributes('style')).toContain('--dismiss-duration: 5000ms')
  })

  it('met le décompte en pause au survol de la souris et le reprend à la sortie', async () => {
    const wrapper = await mountSuspended(AuthNoticeBar, { props: { notice: SUCCESS } })
    vi.advanceTimersByTime(3000)

    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(60000)
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    expect(wrapper.classes()).toContain('auth-notice--paused')

    await wrapper.trigger('pointerleave')
    vi.advanceTimersByTime(2000)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('émet la fermeture au clic sur la croix', async () => {
    const wrapper = await mountSuspended(AuthNoticeBar, { props: { notice: SUCCESS } })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
