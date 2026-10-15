// Branche le client d'API (`utils/api-client.ts`) sur le contexte Nuxt.
export function useApi() {
  const config = useRuntimeConfig()
  const { te } = useI18n()

  return createApiClient({
    baseURL: import.meta.server ? config.apiBase : '',
    fetcher: (url, options) => $fetch(url, options),
    hasTranslation: te,
  })
}
