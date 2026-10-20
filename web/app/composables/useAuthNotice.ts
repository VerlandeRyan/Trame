import type { AuthNotice } from '~/utils/auth'

/** Bandeau posé par le code (déconnexion réussie ou échouée), affiché par `auth/Notice`. */
export function useAuthNotice() {
  return useState<AuthNotice | null>('auth-notice', () => null)
}
