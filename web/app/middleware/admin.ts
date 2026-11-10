/** Administration pages: a visitor goes back home (sign-in), a regular member sees a 404. */
export default defineNuxtRouteMiddleware(() => {
  const { state } = useAuth()
  if (state.value.status === 'authenticated') {
    if (state.value.user.role === 'admin') return
    throw createError({ statusCode: 404, fatal: true })
  }

  if (import.meta.client) useSignInModal().value = true
  return navigateTo(useLocalePath()('/'))
})
