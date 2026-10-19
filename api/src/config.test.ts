import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const base = { DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame' };
  const google = {
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
  };

  it('applique les valeurs par défaut', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      DATABASE_URL: base.DATABASE_URL,
      PORT: 3000,
      WEB_ORIGIN: 'http://localhost:3001',
      SECURE_COOKIES: false,
    });
    expect(config.GOOGLE).toBeUndefined();
  });

  it('génère un secret de session propre à chaque chargement quand il est absent', () => {
    const first = loadConfig(base).SESSION_SECRET;
    expect(first).toHaveLength(64);
    expect(loadConfig(base).SESSION_SECRET).not.toBe(first);
  });

  it('garde le secret de session fourni, à condition qu’il soit assez long', () => {
    const secret = 'x'.repeat(32);
    expect(loadConfig({ ...base, SESSION_SECRET: secret }).SESSION_SECRET).toBe(secret);
    expect(() => loadConfig({ ...base, SESSION_SECRET: 'court' })).toThrow(/SESSION_SECRET/);
  });

  it('active la connexion Google seulement avec les trois réglages', () => {
    expect(loadConfig({ ...base, ...google }).GOOGLE).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: google.GOOGLE_REDIRECT_URI,
    });
    expect(loadConfig({ ...base, GOOGLE_CLIENT_ID: 'id' }).GOOGLE).toBeUndefined();
    expect(loadConfig({ ...base, ...google, GOOGLE_CLIENT_SECRET: '' }).GOOGLE).toBeUndefined();
  });

  const production = { ...base, NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) };

  it('réduit WEB_ORIGIN à son origine', () => {
    const config = loadConfig({ ...base, WEB_ORIGIN: 'https://trame.example/accueil' });
    expect(config.WEB_ORIGIN).toBe('https://trame.example');
  });

  it('exige un secret de session en production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    expect(loadConfig(production).SESSION_SECRET).toBe('x'.repeat(32));
  });

  it('rend les cookies Secure en production, sauf si SECURE_COOKIES dit le contraire', () => {
    expect(loadConfig(production).SECURE_COOKIES).toBe(true);
    expect(loadConfig({ ...production, SECURE_COOKIES: 'false' }).SECURE_COOKIES).toBe(false);
    expect(loadConfig({ ...base, SECURE_COOKIES: 'true' }).SECURE_COOKIES).toBe(true);
    expect(() => loadConfig({ ...base, SECURE_COOKIES: 'oui' })).toThrow(/SECURE_COOKIES/);
  });

  it('lit le nombre de reverse proxys (0 par défaut)', () => {
    expect(loadConfig(base).TRUST_PROXY).toBe(0);
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(loadConfig({ ...base, TRUST_PROXY: '' }).TRUST_PROXY).toBe(0);
    for (const bad of ['-1', 'beaucoup', '1.5', '11']) {
      expect(() => loadConfig({ ...base, TRUST_PROXY: bad })).toThrow(/TRUST_PROXY/);
    }
  });

  it('convertit le port en nombre', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame',
      PORT: '8080',
    });
    expect(config.PORT).toBe(8080);
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/Configuration invalide.*DATABASE_URL/);
  });

  it('refuse un DATABASE_URL vide', () => {
    expect(() => loadConfig({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it.each(['0', '70000', 'abc', '80.5'])('refuse le port invalide %s', (port) => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame', PORT: port }),
    ).toThrow(/PORT/);
  });
});
