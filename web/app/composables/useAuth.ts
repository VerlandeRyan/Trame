/** Shared sign-in state and the actions that change it. */
import { ANONYMOUS, AUTH_STATUS_TIMEOUT_MS, type AuthState } from '~/utils/auth'

/** Sign-in state shared across the app, read during server rendering by the auth plugin. */
export function useAuth() {
  const api = useApi()
  const state = useState<AuthState>('auth', () => ANONYMOUS)
  // During server rendering: pass the cookie extension set by the API on to the browser.
  const event = import.meta.server ? useRequestEvent() : undefined

  /** Copies the API's `Set-Cookie` headers onto the page response. */
  function passCookiesToBrowser({ response }: { response: Response }) {
    if (!event) return
    for (const cookie of response.headers.getSetCookie()) {
      event.node.res.appendHeader('set-cookie', cookie)
    }
  }

  /** Reads who is signed in; any failure counts as anonymous. */
  async function refresh() {
    try {
      state.value = await api.request<AuthState>('/auth/me', {
        timeout: AUTH_STATUS_TIMEOUT_MS,
        onResponse: import.meta.server ? passCookiesToBrowser : undefined,
      })
    } catch {
      state.value = ANONYMOUS
    }
  }

  /** Creates the account with the chosen handle; API errors are passed on to the caller. */
  async function createAccount(handle: string) {
    state.value = await api.request<AuthState>('/auth/handle', {
      method: 'POST',
      body: { handle },
    })
  }

  /** Ends the session (sign-out) or abandons the pending sign-up, then becomes anonymous. */
  async function endSession(endpoint: 'logout' | 'cancel') {
    await api.request(`/auth/${endpoint}`, { method: 'POST' })
    state.value = ANONYMOUS
  }

  /** Signs the user out. */
  const signOut = () => endSession('logout')
  /** Abandons the pending sign-up. */
  const cancelSignup = () => endSession('cancel')

  return { state, refresh, createAccount, signOut, cancelSignup }
}
