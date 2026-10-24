import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LayoutAccountMenu from './AccountMenu.vue'

let loggedOut = 0
let logoutFails = false

describe('LayoutAccountMenu', () => {
  beforeEach(() => {
    useRuntimeConfig().apiBase = ''
    loggedOut = 0
    logoutFails = false
    registerEndpoint('/api/v1/auth/logout', {
      method: 'POST',
      handler: (event) => {
        if (logoutFails) {
          setResponseStatus(event, 500)
          return { code: 'INTERNAL_ERROR' }
        }
        loggedOut += 1
        return null
      },
    })
  })

  it('le dit et reste connecté quand la déconnexion échoue', async () => {
    logoutFails = true
    useState('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'Ryan', role: 'user' },
    }
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' } })
    await wrapper.get('[data-testid="account-menu"]').trigger('click')
    await wrapper.get('[data-testid="sign-out"]').trigger('click')

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() =>
      expect(useAuthNotice().value).toEqual({ key: 'auth.signOutFailed', tone: 'error' }),
    )
    expect(useState('auth').value).toMatchObject({ status: 'authenticated' })
    useAuthNotice().value = null
  })

  it('affiche le pseudo, avec un menu fermé', async () => {
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' } })

    const trigger = wrapper.get('[data-testid="account-menu"]')
    expect(trigger.text()).toBe('@Ryan')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.account-menu__panel').attributes('style')).toContain('display: none')
  })

  it('ouvre le menu au clic, le referme avec Échap', async () => {
    const wrapper = await mountSuspended(LayoutAccountMenu, {
      props: { handle: 'Ryan' },
      attachTo: document.body,
    })
    const trigger = wrapper.get('[data-testid="account-menu"]')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="sign-out"]').isVisible()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('se referme au clic à l’extérieur', async () => {
    const wrapper = await mountSuspended(LayoutAccountMenu, {
      props: { handle: 'Ryan' },
      attachTo: document.body,
    })
    const trigger = wrapper.get('[data-testid="account-menu"]')
    await trigger.trigger('click')

    document.body.click()
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('se referme quand on suit « Ma liste de lecture » ou « Mon profil »', async () => {
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' } })
    const panelStyle = () => wrapper.get('.account-menu__panel').attributes('style') ?? ''

    for (const testId of ['my-list-link', 'profile-link']) {
      await wrapper.get('[data-testid="account-menu"]').trigger('click')
      expect(panelStyle()).not.toContain('display: none')
      await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
      expect(panelStyle()).toContain('display: none')
    }
  })

  it('montre les entrées sans page en inactif, sans groupe Administration', async () => {
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' } })

    expect(wrapper.get('[data-testid="my-list-link"]').attributes('href')).toBeDefined()
    expect(wrapper.get('[data-testid="profile-link"]').attributes('href')).toBe('/u/Ryan')
    for (const testId of ['propose-work-link', 'my-submissions-link']) {
      expect(wrapper.get(`[data-testid="${testId}"]`).attributes('disabled')).toBeDefined()
    }
    expect(wrapper.find('[data-testid="admin-group"]').exists()).toBe(false)
  })

  it('ajoute le groupe Administration pour un admin : le catalogue est un lien, le reste inactif', async () => {
    const wrapper = await mountSuspended(LayoutAccountMenu, {
      props: { handle: 'Ryan', isAdmin: true },
    })

    expect(wrapper.get('[data-testid="admin-group"]').text()).toContain('Administration')
    expect(wrapper.get('[data-testid="admin-catalogue-link"]').attributes('href')).toBe(
      '/admin/catalogue',
    )
    for (const testId of ['admin-submissions-link', 'admin-reports-link']) {
      expect(wrapper.get(`[data-testid="${testId}"]`).attributes('disabled')).toBeDefined()
    }
  })

  it('reste connecté quand on renonce à se déconnecter', async () => {
    useState('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'Ryan', role: 'user' },
    }
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' } })
    await wrapper.get('[data-testid="account-menu"]').trigger('click')
    await wrapper.get('[data-testid="sign-out"]').trigger('click')

    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')

    expect(loggedOut).toBe(0)
    expect(useState('auth').value).toMatchObject({ status: 'authenticated' })
  })

  it('déconnecte puis redevient anonyme', async () => {
    useState('auth').value = {
      status: 'authenticated',
      user: { id: 1, handle: 'Ryan', role: 'user' },
    }
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' } })
    await wrapper.get('[data-testid="account-menu"]').trigger('click')

    await wrapper.get('[data-testid="sign-out"]').trigger('click')
    expect(loggedOut).toBe(0)
    expect(wrapper.get('dialog h2').text()).toBe('Se déconnecter ?')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')

    await vi.waitFor(() => expect(useState('auth').value).toEqual({ status: 'anonymous' }))
    expect(loggedOut).toBe(1)
    expect(useAuthNotice().value).toEqual({ key: 'auth.signedOut', tone: 'success' })
    useAuthNotice().value = null
  })

  async function signOutFrom(route: string, role: 'user' | 'admin' = 'admin') {
    useState('auth').value = { status: 'authenticated', user: { id: 1, handle: 'Ryan', role } }
    const wrapper = await mountSuspended(LayoutAccountMenu, { props: { handle: 'Ryan' }, route })
    await wrapper.get('[data-testid="account-menu"]').trigger('click')
    await wrapper.get('[data-testid="sign-out"]').trigger('click')
    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await vi.waitFor(() => expect(useState('auth').value).toEqual({ status: 'anonymous' }))
  }

  it.each(['/admin/catalogue', '/list'])(
    'revient à l’accueil, avec l’avis, quand on se déconnecte depuis %s',
    async (route) => {
      await signOutFrom(route)

      await vi.waitFor(() => expect(useRouter().currentRoute.value.path).toBe('/'))
      expect(useAuthNotice().value).toEqual({
        key: 'auth.signedOut',
        tone: 'success',
        keepOnce: true,
      })
      useAuthNotice().value = null
    },
  )

  it('reste sur une page publique après la déconnexion', async () => {
    await signOutFrom('/search', 'user')

    expect(useRouter().currentRoute.value.path).toBe('/search')
    useAuthNotice().value = null
  })
})
