// Pages réservées aux membres : un visiteur revient à l'accueil, où la fenêtre de connexion s'ouvre.
export default defineNuxtRouteMiddleware(() => {
  if (useAuth().state.value.status === 'authenticated') return

  if (import.meta.client) useSignInModal().value = true
  return navigateTo(useLocalePath()('/'))
})
