/**
 * Codes d'erreur stables exposés par l'API : ne jamais en improviser en dehors de cette liste.
 * Le `message` est un texte technique en anglais, jamais affiché : le front traduit à partir de `code`.
 */
export const ERROR_CODES = {
  NOT_FOUND: { status: 404, message: 'Resource not found.' },
  VALIDATION_ERROR: { status: 400, message: 'Invalid request.' },
  INVALID_JSON: { status: 400, message: 'Invalid JSON body.' },
  UNAUTHENTICATED: { status: 401, message: 'Authentication required.' },
  HANDLE_REQUIRED: { status: 403, message: 'Choose a handle to finish creating the account.' },
  SIGNUP_EXPIRED: { status: 401, message: 'No sign-up in progress, or it has expired.' },
  ADMIN_REQUIRED: { status: 403, message: 'Administrator role required.' },
  FORBIDDEN_ORIGIN: { status: 403, message: 'Request origin not allowed.' },
  HANDLE_NOT_ALLOWED: { status: 400, message: 'This handle is not allowed.' },
  HANDLE_TAKEN: { status: 409, message: 'This handle is already taken.' },
  AUTH_STATE_INVALID: { status: 400, message: 'Invalid or expired sign-in attempt.' },
  AUTH_UNAVAILABLE: { status: 503, message: 'Google sign-in is not configured.' },
  INTERNAL_ERROR: { status: 500, message: 'Internal error.' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

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

  toBody(): ErrorBody {
    const body: ErrorBody = { code: this.code, message: this.message };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}
