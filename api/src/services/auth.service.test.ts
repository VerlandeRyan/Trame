import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import type { AuthUser, UserRepository } from '../repositories/user.repository.js';
import { createAuthService } from './auth.service.js';
import { unavailableGoogleClient, type GoogleClient } from './google-identity.js';

const identity = { sub: 'sub-1', email: 'ryan@exemple.test' };
const secrets = { codeVerifier: 'v', nonce: 'n' };
const ryan: AuthUser = { id: 1, handle: 'Ryan', role: 'user' };

const google: GoogleClient = {
  start: () => Promise.resolve({ url: 'https://g.example', state: 's', ...secrets }),
  verify: () => Promise.resolve(identity),
};

function fakeUsers(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: () => Promise.resolve(null),
    findByGoogleSub: () => Promise.resolve(null),
    create: () => Promise.resolve({ status: 'created', user: ryan }),
    ...overrides,
  };
}

const knownAccount = (deleted: boolean) => () => Promise.resolve({ user: ryan, deleted });

describe('finishLogin', () => {
  it('connecte un compte existant', async () => {
    const service = createAuthService({
      google,
      users: fakeUsers({ findByGoogleSub: knownAccount(false) }),
    });
    expect(await service.finishLogin('code', secrets)).toEqual({ kind: 'existing', user: ryan });
  });

  it('met une identité inconnue en attente de handle', async () => {
    const service = createAuthService({ google, users: fakeUsers() });
    expect(await service.finishLogin('code', secrets)).toEqual({ kind: 'new', identity });
  });

  it('refuse un compte supprimé', async () => {
    const service = createAuthService({
      google,
      users: fakeUsers({ findByGoogleSub: knownAccount(true) }),
    });
    await expect(service.finishLogin('code', secrets)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('createAccount', () => {
  it('crée le compte avec l’e-mail et l’identifiant Google', async () => {
    let created: unknown;
    const service = createAuthService({
      google,
      users: fakeUsers({
        create: (user) => {
          created = user;
          return Promise.resolve({ status: 'created', user: ryan });
        },
      }),
    });
    expect(await service.createAccount(identity, 'Ryan')).toEqual(ryan);
    expect(created).toEqual({ googleSub: 'sub-1', email: 'ryan@exemple.test', handle: 'Ryan' });
  });

  it('refuse un handle interdit avant tout accès à la base', async () => {
    const service = createAuthService({
      google,
      users: fakeUsers({ create: () => Promise.reject(new Error('ne doit pas être appelé')) }),
    });
    await expect(service.createAccount(identity, 'Admin')).rejects.toMatchObject({
      code: 'HANDLE_NOT_ALLOWED',
    });
  });

  it.each([
    ['handle_taken', 'HANDLE_TAKEN'],
    ['handle_rejected', 'HANDLE_NOT_ALLOWED'],
  ] as const)('traduit le résultat %s en %s', async (status, code) => {
    const service = createAuthService({
      google,
      users: fakeUsers({ create: () => Promise.resolve({ status }) }),
    });
    await expect(service.createAccount(identity, 'Ryan')).rejects.toMatchObject({ code });
  });

  it('reprend le compte existant quand le même compte Google s’inscrit deux fois', async () => {
    const service = createAuthService({
      google,
      users: fakeUsers({
        create: () => Promise.resolve({ status: 'already_registered' }),
        findByGoogleSub: knownAccount(false),
      }),
    });
    expect(await service.createAccount(identity, 'Ryan')).toEqual(ryan);
  });

  it('laisse remonter une erreur inattendue', async () => {
    const boom = new Error('boom');
    const service = createAuthService({
      google,
      users: fakeUsers({ create: () => Promise.reject(boom) }),
    });
    await expect(service.createAccount(identity, 'Ryan')).rejects.toBe(boom);
  });
});

describe('client Google non configuré', () => {
  it('répond AUTH_UNAVAILABLE', async () => {
    await expect(unavailableGoogleClient.start()).rejects.toBeInstanceOf(AppError);
    await expect(unavailableGoogleClient.verify('c', secrets)).rejects.toMatchObject({
      code: 'AUTH_UNAVAILABLE',
    });
  });
});
