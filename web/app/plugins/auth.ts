import { hasSessionCookie } from '~/utils/auth'

// Lit l'état de connexion au rendu serveur, seulement pour un visiteur qui a un cookie de session.
export default defineNuxtPlugin(async () => {
  if (import.meta.server && hasSessionCookie(useRequestHeaders(['cookie']).cookie)) {
    await useAuth().refresh()
  }
})
