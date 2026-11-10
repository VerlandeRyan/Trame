/** Member-only pages: a visitor goes back home, where the sign-in window opens. */
export default defineNuxtRouteMiddleware(() => {
  if (useAuth().state.value.status === 'authenticated') return

  if (import.meta.client) useSignInModal().value = true
  return navigateTo(useLocalePath()('/'))
})
