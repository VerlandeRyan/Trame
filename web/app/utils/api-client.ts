/** REST API client built on an injected fetcher, so it can be used and tested without Nuxt. */
import { errorMessageKey, toApiError, type ApiError } from './api-error'

/** HTTP call function (Nuxt's `$fetch` in the app). */
type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>

/** What the client needs from its environment. */
interface ApiClientDependencies {
  /** Internal address of the API (the runtime config's API base). */
  baseURL: string
  /** HTTP call; injected so tests can replace it. */
  fetcher: Fetcher
  /** Tells whether a translation key exists (vue-i18n's `te`). */
  hasTranslation: (key: string) => boolean
  /** Headers of every call: the visitor's cookie during server rendering (absent in the browser). */
  defaultHeaders?: Record<string, string>
}

/** Creates the client of the versioned REST API, with no dependency on Nuxt. See `useApi()`. */
export function createApiClient({
  baseURL,
  fetcher,
  hasTranslation,
  defaultHeaders,
}: ApiClientDependencies) {
  /** Calls the API; throws an `ApiError` (stable code) on failure. */
  async function request<T>(path: string, options: Record<string, unknown> = {}): Promise<T> {
    const headers = defaultHeaders
      ? { ...defaultHeaders, ...(options.headers as Record<string, string> | undefined) }
      : options.headers
    try {
      const callOptions = headers === undefined ? options : { ...options, headers }
      return (await fetcher(`/api/v1${path}`, { baseURL, ...callOptions })) as T
    } catch (error) {
      throw toApiError(error)
    }
  }

  /** Translation key to display for an API error. */
  function messageKeyFor(error: ApiError): string {
    return errorMessageKey(error.code, hasTranslation)
  }

  return { request, messageKeyFor }
}
