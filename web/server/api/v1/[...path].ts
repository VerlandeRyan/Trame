// Relais vers l'API : le navigateur appelle toujours ce même site (`/api/v1/…`), jamais l'API
// directement (adresse interne, pas de CORS). Lecture seule pour l'instant ; les écritures
// arriveront avec la connexion (cookie de session).
export default defineEventHandler((event) => {
  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const path = getRouterParam(event, 'path') ?? ''
  if (path.split('/').includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const { apiBase } = useRuntimeConfig(event)
  return proxyRequest(event, `${apiBase}/api/v1/${path}${getRequestURL(event).search}`)
})
