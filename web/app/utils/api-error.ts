// Erreurs d'API : le front lit toujours `code` (stable), jamais `message` (texte technique anglais).
export interface ApiError {
  status: number
  code: string
  details?: unknown[]
}

const FALLBACK_CODE = 'INTERNAL_ERROR'

/** Normalise une erreur de `$fetch` (ou toute erreur) en `ApiError`. */
export function toApiError(error: unknown): ApiError {
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
