import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { attachUser, checkOrigin, requireAdmin, requireUser } from './auth.js';

/** Appelle un middleware et renvoie ce que `next` a reçu (`undefined` = on continue). */
async function run(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Partial<Request>,
): Promise<unknown> {
  return new Promise((resolve) => {
    void middleware(req as Request, {} as Response, (err?: unknown) => resolve(err));
  });
}

const ryan = { id: 1, handle: 'Ryan', role: 'user' as const };

describe('checkOrigin', () => {
  const check = checkOrigin('https://trame.example');
  const request = (method: string, origin?: string) =>
    ({ method, get: () => origin }) as unknown as Partial<Request>;

  it('laisse passer une écriture venant du front', async () => {
    expect(await run(check, request('POST', 'https://trame.example'))).toBeUndefined();
  });

  it('laisse passer une écriture sans en-tête Origin (outils, tests)', async () => {
    expect(await run(check, request('DELETE'))).toBeUndefined();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'refuse un %s venant d’une autre origine',
    async (m) => {
      expect(await run(check, request(m, 'https://evil.example'))).toMatchObject({
        code: 'FORBIDDEN_ORIGIN',
      });
    },
  );

  it('ne contrôle pas les lectures', async () => {
    expect(await run(check, request('GET', 'https://evil.example'))).toBeUndefined();
  });
});

describe('attachUser', () => {
  it('pose l’utilisateur de la session', async () => {
    const req = { session: { userId: 1 } } as unknown as Request;
    const err = await run(
      attachUser(() => Promise.resolve(ryan)),
      req,
    );
    expect(err).toBeUndefined();
    expect(req.user).toEqual(ryan);
  });

  it('marque une inscription en attente', async () => {
    const req = { session: { pending: { sub: 's', email: 'e' } } } as unknown as Request;
    await run(
      attachUser(() => Promise.resolve(null)),
      req,
    );
    expect(req.user).toBeUndefined();
    expect(req.hasPendingSignup).toBe(true);
  });

  it('détruit la session dont le compte a disparu', async () => {
    let destroyed = false;
    const req = {
      session: {
        userId: 9,
        destroy: (done: () => void) => {
          destroyed = true;
          done();
        },
      },
    } as unknown as Request;
    await run(
      attachUser(() => Promise.resolve(null)),
      req,
    );
    expect(destroyed).toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('transmet une erreur de lecture', async () => {
    const boom = new Error('boom');
    const req = { session: { userId: 1 } } as unknown as Request;
    expect(
      await run(
        attachUser(() => Promise.reject(boom)),
        req,
      ),
    ).toBe(boom);
  });
});

describe('requireUser et requireAdmin', () => {
  it('laissent passer un utilisateur connecté, l’admin seulement pour requireAdmin', async () => {
    expect(await run(requireUser, { user: ryan })).toBeUndefined();
    expect(await run(requireAdmin, { user: { ...ryan, role: 'admin' } })).toBeUndefined();
    expect(await run(requireAdmin, { user: ryan })).toMatchObject({ code: 'ADMIN_REQUIRED' });
  });

  it('distinguent visiteur et inscription à terminer', async () => {
    expect(await run(requireUser, {})).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await run(requireUser, { hasPendingSignup: true })).toMatchObject({
      code: 'HANDLE_REQUIRED',
    });
    expect(await run(requireAdmin, {})).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
