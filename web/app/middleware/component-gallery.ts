/** Restricts the component gallery to environments where it is enabled (public runtime config); 404 otherwise. */
export default defineNuxtRouteMiddleware(() => {
  if (useRuntimeConfig().public.componentGallery) return

  return abortNavigation(createError({ statusCode: 404 }))
})
