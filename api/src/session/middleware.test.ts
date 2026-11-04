import { describe, expect, it } from 'vitest';
import { cookieOptions, sessionCookieName } from './middleware.js';

describe('sessionCookieName', () => {
  it('porte le préfixe __Host- quand le cookie est Secure', () => {
    expect(sessionCookieName(true)).toBe('__Host-trame.sid');
  });

  it('garde le nom simple en HTTP, où le navigateur refuserait le préfixe', () => {
    expect(sessionCookieName(false)).toBe('trame.sid');
  });
});

describe('cookieOptions', () => {
  it('fixe Path=/ sans Domain, comme l’exige le préfixe __Host-', () => {
    const options = cookieOptions(true);
    expect(options).toMatchObject({ path: '/', secure: true, httpOnly: true, sameSite: 'lax' });
    expect(options).not.toHaveProperty('domain');
  });
});
