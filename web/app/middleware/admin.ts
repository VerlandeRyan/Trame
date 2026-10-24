// Pages d'administration : un visiteur revient à l'accueil (connexion), un membre simple voit une 404.
export default defineNuxtRouteMiddleware(() => {
  const { state } = useAuth()
  if (state.value.status === 'authenticated') {
    if (state.value.user.role === 'admin') return
    throw createError({ statusCode: 404, fatal: true })
  }

  if (import.meta.client) useSignInModal().value = true
  return navigateTo(useLocalePath()('/'))
})
