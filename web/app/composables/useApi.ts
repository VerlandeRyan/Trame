/** Hooks the API client into the Nuxt context. */
type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>

// `$fetch` is typed by Nitro's routes: matching it against a free address exceeds TypeScript's
// depth limit.
/** Calls Nuxt's `$fetch` through a loose type. */
const fetcher: Fetcher = (url, options) => ($fetch as unknown as Fetcher)(url, options)

/** The API client, with the server address and the visitor's cookie set up for the current context. */
export function useApi() {
  const config = useRuntimeConfig()
  // `$i18n` rather than `useI18n()`: also usable inside a plugin.
  const { te } = useNuxtApp().$i18n

  return createApiClient({
    baseURL: import.meta.server ? config.apiBase : '',
    fetcher,
    hasTranslation: te,
    // During server rendering the API recognises the visitor by their cookie: it is sent with every call.
    defaultHeaders: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
  })
}
