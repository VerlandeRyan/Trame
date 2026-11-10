/**
 * Stable error codes exposed by the API: never invent one outside this list.
 * The `message` is a technical English text that is never displayed: the front end translates from `code`.
 */
export const ERROR_CODES = {
  NOT_FOUND: { status: 404, message: 'Resource not found.' },
  VALIDATION_ERROR: { status: 400, message: 'Invalid request.' },
  INVALID_JSON: { status: 400, message: 'Invalid JSON body.' },
  UNAUTHENTICATED: { status: 401, message: 'Authentication required.' },
  HANDLE_REQUIRED: { status: 403, message: 'Choose a handle to finish creating the account.' },
  SIGNUP_EXPIRED: { status: 401, message: 'No sign-up in progress, or it has expired.' },
  ADMIN_REQUIRED: { status: 403, message: 'Administrator role required.' },
  PROFILE_PRIVATE: { status: 403, message: 'This profile is private.' },
  PERSON_HAS_WORKS: { status: 409, message: 'This person is still credited on active works.' },
  PUBLISHER_HAS_WORKS: { status: 409, message: 'This publisher still has active works.' },
  INVALID_REFERENCE: { status: 400, message: 'A referenced record does not exist.' },
  ARCHIVED_REFERENCE: { status: 400, message: 'A referenced record is archived.' },
  STALE_RECORD: { status: 409, message: 'The record was modified since it was read.' },
  FORBIDDEN_ORIGIN: { status: 403, message: 'Request origin not allowed.' },
  HANDLE_NOT_ALLOWED: { status: 400, message: 'This handle is not allowed.' },
  HANDLE_TAKEN: { status: 409, message: 'This handle is already taken.' },
  AUTH_STATE_INVALID: { status: 400, message: 'Invalid or expired sign-in attempt.' },
  AUTH_UNAVAILABLE: { status: 503, message: 'Google sign-in is not configured.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests, try again later.' },
  INTERNAL_ERROR: { status: 500, message: 'Internal error.' },
} as const;

/** One of the stable error codes. */
export type ErrorCode = keyof typeof ERROR_CODES;

/** JSON body of every error response. */
export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Expected error carrying a stable code; the error handler turns it into the HTTP response. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, details?: unknown) {
    super(ERROR_CODES[code].message);
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.details = details;
  }

  /** Builds the response body of this error. */
  toBody(): ErrorBody {
    const body: ErrorBody = { code: this.code, message: this.message };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}
