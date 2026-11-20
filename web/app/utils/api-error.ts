/** API errors: the front end always reads `code` (stable), never `message` (technical English text). */
import { ERROR_CODES, type ErrorCode } from '../contract/api'

/** An API error reduced to what the front end uses. */
export interface ApiError {
  status: number
  code: ErrorCode
  details?: unknown[]
}

/** Code used when an error carries none, or one the contract does not list. */
const FALLBACK_CODE = 'INTERNAL_ERROR' satisfies ErrorCode

const KNOWN_ERROR_CODES = new Set<unknown>(ERROR_CODES)

/** Whether a value is an error code of the contract. */
function isErrorCode(value: unknown): value is ErrorCode {
  return KNOWN_ERROR_CODES.has(value)
}

/** Whether the error is already normalised: numeric `status` and known `code`, no raw HTTP response. */
function isApiError(error: unknown): error is ApiError {
  const candidate = error as Partial<ApiError> & { response?: unknown }
  return (
    typeof candidate?.status === 'number' &&
    isErrorCode(candidate.code) &&
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
  const code = isErrorCode(body?.code) ? body.code : FALLBACK_CODE
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
