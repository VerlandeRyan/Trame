import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/errors.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { validate } from '../src/middleware/validate.js';

const req = {} as Request;

describe('validate (unitaire)', () => {
  it('expose les valeurs autorisées numériques sans la valeur saisie', () => {
    const next = vi.fn();
    const handler = validate('body', z.object({ rank: z.literal([1, 2]) }));

    handler({ body: { rank: 3 } } as Request, {} as Response, next);

    const err = next.mock.calls[0]?.[0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.details).toEqual([{ path: ['rank'], code: 'invalid_value', values: [1, 2] }]);
  });
});

describe('errorHandler (unitaire)', () => {
  it('délègue à Express quand la réponse est déjà partie', () => {
    const err = new Error('trop tard');
    const next = vi.fn();
    const res = { headersSent: true, status: vi.fn(), json: vi.fn() };

    errorHandler(err, req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('renvoie le statut et le corps d’une AppError avec ses détails', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { headersSent: false, status };

    errorHandler(new AppError('VALIDATION_ERROR', [{ path: ['title'] }]), req, res as unknown as Response, vi.fn());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request.',
      details: [{ path: ['title'] }],
    });
  });

  it('traite une valeur non-objet comme une erreur interne', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { headersSent: false, status };

    errorHandler('chaîne levée', req, res as unknown as Response, vi.fn());
    spy.mockRestore();

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ code: 'INTERNAL_ERROR', message: 'Internal error.' });
  });
});
