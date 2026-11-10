/** Nuxt plugin that restores the sign-in state during server rendering. */
import { hasSessionCookie } from '~/utils/auth'

/** Reads the sign-in state during server rendering, only for a visitor who has a session cookie. */
export default defineNuxtPlugin(async () => {
  if (import.meta.server && hasSessionCookie(useRequestHeaders(['cookie']).cookie)) {
    await useAuth().refresh()
  }
})
