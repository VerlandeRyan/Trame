// Relais vers l'API : le navigateur appelle toujours ce site (`/api/v1/…`), jamais l'API, ce qui
// garde le cookie de session de même origine. Règles dans `shared/utils/api-relay.ts`.
export default defineEventHandler((event) => {
  const path = getRouterParam(event, 'path') ?? ''
  const verdict = judgeRelayRequest(event.method, path)
  if (verdict === 'method-not-allowed') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  if (verdict === 'bad-request') {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const { apiBase } = useRuntimeConfig(event)
  const clientChain = forwardedFor(getRequestHeader(event, 'x-forwarded-for'), getRequestIP(event))
  // Redirections (Google, retour sur le site) et cookies sont relayés tels quels.
  return proxyRequest(event, `${apiBase}/api/v1/${path}${getRequestURL(event).search}`, {
    fetchOptions: { redirect: 'manual' },
    ...(clientChain && { headers: { 'x-forwarded-for': clientChain } }),
  })
})
