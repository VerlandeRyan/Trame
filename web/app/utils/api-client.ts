import { errorMessageKey, toApiError, type ApiError } from './api-error'

type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>

interface ApiClientDependencies {
  /** Adresse interne de l'API (runtimeConfig.apiBase). */
  baseURL: string
  /** Appel HTTP (`$fetch` de Nuxt) ; injecté pour pouvoir être remplacé dans les tests. */
  fetcher: Fetcher
  /** Dit si une clé de traduction existe (`te` de vue-i18n). */
  hasTranslation: (key: string) => boolean
  /** En-têtes de tous les appels : le cookie du visiteur au rendu serveur (absents au navigateur). */
  defaultHeaders?: Record<string, string>
}

/** Client de l'API REST sous `/api/v1`, sans dépendance à Nuxt. Voir `useApi()`. */
export function createApiClient({
  baseURL,
  fetcher,
  hasTranslation,
  defaultHeaders,
}: ApiClientDependencies) {
  /** Appelle l'API ; lève une `ApiError` (code stable) en cas d'échec. */
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

  /** Clé de traduction à afficher pour une erreur d'API. */
  function messageKeyFor(error: ApiError): string {
    return errorMessageKey(error.code, hasTranslation)
  }

  return { request, messageKeyFor }
}
