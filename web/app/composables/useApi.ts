// Branche le client d'API (`utils/api-client.ts`) sur le contexte Nuxt.
type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>

// `$fetch` est typé par les routes de Nitro : le comparer à une adresse libre dépasse la
// profondeur de TypeScript.
const fetcher: Fetcher = (url, options) => ($fetch as unknown as Fetcher)(url, options)

export function useApi() {
  const config = useRuntimeConfig()
  // `$i18n` plutôt que `useI18n()` : utilisable aussi dans un plugin.
  const { te } = useNuxtApp().$i18n

  return createApiClient({
    baseURL: import.meta.server ? config.apiBase : '',
    fetcher,
    hasTranslation: te,
  })
}
