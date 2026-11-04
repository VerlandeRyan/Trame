// Erreurs d'API : le front lit toujours `code` (stable), jamais `message` (texte technique anglais).
export interface ApiError {
  status: number
  code: string
  details?: unknown[]
}

const FALLBACK_CODE = 'INTERNAL_ERROR'

/** Une erreur déjà normalisée : `status` numérique et `code` texte, sans réponse HTTP brute. */
function isApiError(error: unknown): error is ApiError {
  const candidate = error as Partial<ApiError> & { response?: unknown }
  return (
    typeof candidate?.status === 'number' &&
    typeof candidate.code === 'string' &&
    candidate.response === undefined
  )
}

/** Normalise une erreur de `$fetch` (ou toute erreur) en `ApiError` ; idempotent. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  const candidate = error as {
    status?: number
    statusCode?: number
    data?: { code?: unknown; details?: unknown }
    response?: { status?: number; _data?: { code?: unknown; details?: unknown } }
  }
  const body = candidate?.data ?? candidate?.response?._data
  const status = candidate?.response?.status ?? candidate?.statusCode ?? candidate?.status ?? 0
  const code = typeof body?.code === 'string' ? body.code : FALLBACK_CODE
  const details = Array.isArray(body?.details) ? body.details : undefined
  return { status, code, details }
}

/** Clé de traduction d'un code d'erreur ; repli sur `error.INTERNAL_ERROR` si la clé n'existe pas. */
export function errorMessageKey(
  code: string | undefined,
  hasKey: (key: string) => boolean,
): string {
  const key = `error.${code}`
  return code && hasKey(key) ? key : `error.${FALLBACK_CODE}`
}
