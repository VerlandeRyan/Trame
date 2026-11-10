/** Shared state of the sign-in banner that code can set. */
import type { AuthNotice } from '~/utils/auth'

/** Banner set by code (successful or failed sign-out), displayed by the auth notice component. */
export function useAuthNotice() {
  return useState<AuthNotice | null>('auth-notice', () => null)
}
