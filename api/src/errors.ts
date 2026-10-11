/**
 * Codes d'erreur stables exposés par l'API : ne jamais en improviser en dehors de cette liste.
 * Le `message` est un texte technique en anglais, jamais affiché : le front traduit à partir de `code`.
 */
export const ERROR_CODES = {
  NOT_FOUND: { status: 404, message: 'Resource not found.' },
  VALIDATION_ERROR: { status: 400, message: 'Invalid request.' },
  INVALID_JSON: { status: 400, message: 'Invalid JSON body.' },
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
