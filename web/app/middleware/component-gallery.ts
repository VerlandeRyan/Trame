// Réserve la galerie de composants aux environnements où elle est activée
// (`runtimeConfig.public.componentGallery`) : 404 sinon.
export default defineNuxtRouteMiddleware(() => {
  if (useRuntimeConfig().public.componentGallery) return

  return abortNavigation(createError({ statusCode: 404 }))
})
