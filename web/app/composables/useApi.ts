// Branche le client d'API (`utils/api-client.ts`) sur le contexte Nuxt.
// Appels côté serveur (SSR) vers `runtimeConfig.apiBase` ; les appels depuis le navigateur
// passeront par un proxy Nitro avec la connexion (cookie de session).
export function useApi() {
  const config = useRuntimeConfig()
  const { te } = useI18n()

  return createApiClient({
    baseURL: config.apiBase,
    fetcher: (url, options) => $fetch(url, options),
    hasTranslation: te,
  })
}
