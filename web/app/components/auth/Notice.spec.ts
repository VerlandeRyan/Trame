import { mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthNotice from './Notice.vue'

// Une instance restée montée verrait le même avis et l'effacerait à la navigation.
enableAutoUnmount(afterEach)

describe('AuthNotice', () => {
  it("n'affiche rien sans motif de retour de Google", async () => {
    const wrapper = await mountSuspended(AuthNotice, { route: '/' })

    expect(wrapper.find('[data-testid="auth-notice"]').exists()).toBe(false)
  })

  it("annonce l'annulation de la connexion", async () => {
    const wrapper = await mountSuspended(AuthNotice, { route: '/?auth_error=cancelled' })

    const notice = wrapper.get('[data-testid="auth-notice"]')
    expect(notice.attributes('role')).toBe('alert')
    expect(notice.text()).toBe('Connexion annulée. Tu peux recommencer quand tu veux.')
  })

  it("traduit un code d'erreur de l'API, jamais son message", async () => {
    const wrapper = await mountSuspended(AuthNotice, { route: '/?auth_error=AUTH_UNAVAILABLE' })

    expect(wrapper.get('[data-testid="auth-notice"]').text()).toBe(
      'La connexion est indisponible pour le moment.',
    )
  })

  it("se ferme et retire le paramètre de l'adresse", async () => {
    const wrapper = await mountSuspended(AuthNotice, {
      route: '/?auth_error=cancelled&utm=1',
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.find('[data-testid="auth-notice"]').exists()).toBe(false)
    await vi.waitFor(() => expect(useRoute().query).toEqual({ utm: '1' }))
  })

  it('colore l’avis selon sa nature : jaune, vert ou rouge', async () => {
    const info = await mountSuspended(AuthNotice, { route: '/?auth_error=cancelled' })
    expect(info.get('[data-testid="auth-notice"]').classes()).toContain('auth-notice--info')

    const failure = await mountSuspended(AuthNotice, { route: '/?auth_error=AUTH_UNAVAILABLE' })
    expect(failure.get('[data-testid="auth-notice"]').classes()).toContain('auth-notice--error')

    const success = await mountSuspended(AuthNotice, { route: '/' })
    useAuthNotice().value = { key: 'auth.signedOut', tone: 'success' }
    await nextTick()
    expect(success.get('[data-testid="auth-notice"]').classes()).toContain('auth-notice--success')
    useAuthNotice().value = null
  })

  it('confirme une déconnexion posée par le code, jusqu’à la navigation suivante', async () => {
    const wrapper = await mountSuspended(AuthNotice, { route: '/' })
    useAuthNotice().value = { key: 'auth.signedOut', tone: 'success' }
    await nextTick()

    expect(wrapper.get('[data-testid="auth-notice"]').text()).toBe(
      'Tu es déconnecté. À bientôt sur Trame !',
    )

    await navigateTo('/search')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="auth-notice"]').exists()).toBe(false))
  })

  it('garde un avis posé avec une redirection à travers cette redirection seulement', async () => {
    const wrapper = await mountSuspended(AuthNotice, { route: '/search' })
    useAuthNotice().value = { key: 'auth.signedOut', tone: 'success', keepOnce: true }
    await nextTick()
    const isShown = () => wrapper.find('[data-testid="auth-notice"]').exists()

    await navigateTo('/')
    await vi.waitFor(() => expect(useRoute().path).toBe('/'))
    await flushPromises()
    expect(isShown()).toBe(true)

    await navigateTo('/search?q=a')
    await vi.waitFor(() => expect(isShown()).toBe(false))
  })

  it('se ferme avec la croix', async () => {
    const wrapper = await mountSuspended(AuthNotice, { route: '/' })
    useAuthNotice().value = { key: 'auth.signedOut', tone: 'success' }
    await nextTick()

    await wrapper.get('button').trigger('click')

    expect(useAuthNotice().value).toBeNull()
    expect(wrapper.find('[data-testid="auth-notice"]').exists()).toBe(false)
  })
})
