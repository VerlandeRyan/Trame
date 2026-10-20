import { ANONYMOUS, AUTH_STATUS_TIMEOUT_MS, type AuthState } from '~/utils/auth'

/** État de connexion partagé, lu au rendu serveur par `plugins/auth.ts`. */
export function useAuth() {
  const api = useApi()
  const state = useState<AuthState>('auth', () => ANONYMOUS)
  // Au rendu serveur : transmettre le cookie du visiteur à l'API et, en retour, sa prolongation.
  const event = import.meta.server ? useRequestEvent() : undefined
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  function passCookiesToBrowser({ response }: { response: Response }) {
    if (!event) return
    for (const cookie of response.headers.getSetCookie()) {
      event.node.res.appendHeader('set-cookie', cookie)
    }
  }

  async function refresh() {
    try {
      state.value = await api.request<AuthState>('/auth/me', {
        headers,
        timeout: AUTH_STATUS_TIMEOUT_MS,
        onResponse: import.meta.server ? passCookiesToBrowser : undefined,
      })
    } catch {
      state.value = ANONYMOUS
    }
  }

  async function createAccount(handle: string) {
    state.value = await api.request<AuthState>('/auth/handle', {
      method: 'POST',
      body: { handle },
    })
  }

  async function endSession(endpoint: 'logout' | 'cancel') {
    await api.request(`/auth/${endpoint}`, { method: 'POST' })
    state.value = ANONYMOUS
  }

  const signOut = () => endSession('logout')
  const cancelSignup = () => endSession('cancel')

  return { state, refresh, createAccount, signOut, cancelSignup }
}
