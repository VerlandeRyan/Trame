/** API errors: the front end always reads `code` (stable), never `message` (technical English text). */

/** An API error reduced to what the front end uses. */
export interface ApiError {
  status: number
  code: string
  details?: unknown[]
}

/** Code used when an error carries none. */
const FALLBACK_CODE = 'INTERNAL_ERROR'

/** Whether the error is already normalised: numeric `status` and text `code`, no raw HTTP response. */
function isApiError(error: unknown): error is ApiError {
  const candidate = error as Partial<ApiError> & { response?: unknown }
  return (
    typeof candidate?.status === 'number' &&
    typeof candidate.code === 'string' &&
    candidate.response === undefined
  )
}

/** Normalises a `$fetch` error (or any error) into an `ApiError`; idempotent. */
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

/** Translation key of an error code; falls back to `error.INTERNAL_ERROR` when the key does not exist. */
export function errorMessageKey(
  code: string | undefined,
  hasKey: (key: string) => boolean,
): string {
  const key = `error.${code}`
  return code && hasKey(key) ? key : `error.${FALLBACK_CODE}`
}
