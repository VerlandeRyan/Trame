/**
 * Relay to the API: the browser always calls this site, never the API, which keeps the session
 * cookie same-origin. Rules live in `shared/utils/api-relay.ts`.
 */
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
  // Redirects (Google, return to the site) and cookies are relayed as they are.
  return proxyRequest(event, `${apiBase}/api/v1/${path}${getRequestURL(event).search}`, {
    fetchOptions: { redirect: 'manual' },
    ...(clientChain && { headers: { 'x-forwarded-for': clientChain } }),
  })
})
