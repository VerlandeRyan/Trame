import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { AppError } from '../errors.js';
import type { GoogleClient } from '../services/google-identity.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const WEB = 'http://localhost:3001';
const BASE = '/api/v1/auth';
const client = new pg.Client({ connectionString });
const db = createDb(connectionString);

/** Doublure de Google : le « code » vaut `sub|email`, le PKCE est vérifié. */
let attempts = 0;
const google: GoogleClient = {
  async start() {
    attempts += 1;
    const state = `state-${attempts}`;
    return {
      url: `https://accounts.example/auth?state=${state}`,
      state,
      codeVerifier: `verifier-${attempts}`,
      nonce: `nonce-${attempts}`,
    };
  },
  async verify(code, { codeVerifier }) {
    if (code === 'refused' || !codeVerifier.startsWith('verifier-')) {
      throw new AppError('AUTH_STATE_INVALID');
    }
    const [sub, email] = code.split('|');
    return { sub, email };
  },
};

const authOptions = { google, webOrigin: WEB, sessionSecret: 's'.repeat(32) };
// Les tests enchaînent bien plus de connexions que la limite réelle : on la relève.
const app = createApp({
  db,
  auth: { ...authOptions, rateLimit: { windowMs: 60_000, limit: 10_000 } },
});
const limitedApp = createApp({
  db,
  auth: { ...authOptions, rateLimit: { windowMs: 60_000, limit: 3 } },
});
const appWithoutGoogle = createApp({ db });

beforeAll(() => client.connect());
afterAll(async () => {
  await client.end();
  await db.destroy();
});
beforeEach(async () => {
  await client.query('TRUNCATE session, app_user RESTART IDENTITY CASCADE');
});

type Agent = ReturnType<typeof request.agent>;

/** Visite `/auth/google` puis renvoie le code donné, comme le ferait Google. */
async function signIn(agent: Agent, code: string, returnTo?: string) {
  const start = await agent.get(`${BASE}/google`).query(returnTo ? { returnTo } : {});
  const state = new URL(start.headers.location as string).searchParams.get('state');
  return agent.get(`${BASE}/google/callback`).query({ code, state });
}

async function newAccount(handle = 'Ryan', code = 'sub-1|ryan@exemple.test'): Promise<Agent> {
  const agent = request.agent(app);
  await signIn(agent, code);
  const res = await agent.post(`${BASE}/handle`).send({ handle });
  expect(res.status).toBe(201);
  return agent;
}

describe('GET /auth/google', () => {
  it('redirige vers Google et pose un cookie de session httpOnly, SameSite=Lax', async () => {
    const res = await request(app).get(`${BASE}/google`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/accounts\.example\/auth\?state=/);
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/^trame\.sid=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('répond AUTH_UNAVAILABLE quand Google n’est pas configuré', async () => {
    const res = await request(appWithoutGoogle).get(`${BASE}/google`);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AUTH_UNAVAILABLE');
  });
});

describe('retour à la page d’origine (returnTo)', () => {
  it('ramène un compte existant sur la page demandée, langue comprise', async () => {
    await newAccount();
    const res = await signIn(request.agent(app), 'sub-1|ryan@exemple.test', '/en/work/42-aube');
    expect(res.headers.location).toBe(`${WEB}/en/work/42-aube`);
  });

  it('transmet returnTo à l’écran du handle pour un nouveau compte', async () => {
    const res = await signIn(request.agent(app), 'sub-1|ryan@exemple.test', '/en/work/42?a=b');
    expect(res.headers.location).toBe(
      `${WEB}/signup/handle?returnTo=${encodeURIComponent('/en/work/42?a=b')}`,
    );
  });

  it.each(['https://evil.example/', '//evil.example', '/\\evil.example', 'work/42', '/a b'])(
    'ignore le returnTo %j qui n’est pas un chemin du site',
    async (returnTo) => {
      await newAccount();
      const res = await signIn(request.agent(app), 'sub-1|ryan@exemple.test', returnTo);
      expect(res.headers.location).toBe(`${WEB}/`);
    },
  );
});

describe('GET /auth/me', () => {
  it('répond anonymous sans session, sans en créer', async () => {
    const res = await request(app).get(`${BASE}/me`);
    expect(res.body).toEqual({ status: 'anonymous' });
    expect(res.headers['set-cookie']).toBeUndefined();
    expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(0);
  });
});

describe('première connexion (création du compte au choix du handle)', () => {
  it('met l’identité en attente, sans créer de compte', async () => {
    const agent = request.agent(app);
    const res = await signIn(agent, 'sub-1|ryan@exemple.test');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${WEB}/signup/handle`);
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'pending' });
    expect((await client.query('SELECT 1 FROM app_user')).rowCount).toBe(0);
    // L’attente dure 10 minutes.
    const cookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookie[0]).toMatch(/Max-Age=600|Expires=/);
  });

  it('crée le compte avec la casse choisie, sans nom Google, et connecte', async () => {
    const agent = await newAccount('Ryan');
    expect((await agent.get(`${BASE}/me`)).body).toEqual({
      status: 'authenticated',
      user: { id: 1, handle: 'Ryan', role: 'user' },
    });
    const row = (await client.query('SELECT * FROM app_user')).rows[0];
    expect(row).toMatchObject({
      handle: 'Ryan',
      email: 'ryan@exemple.test',
      google_sub: 'sub-1',
      display_name: null,
      role: 'user',
    });
  });

  it('ne laisse ni e-mail ni identifiant Google dans la session d’un compte connecté', async () => {
    await newAccount();
    const sessions = (await client.query('SELECT sess FROM session')).rows;
    const text = JSON.stringify(sessions);
    expect(text).not.toContain('ryan@exemple.test');
    expect(text).not.toContain('sub-1');
  });

  it('change d’identifiant de session à la connexion', async () => {
    const agent = request.agent(app);
    const first = await agent.get(`${BASE}/google`);
    const before = (first.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const state = new URL(first.headers.location as string).searchParams.get('state');
    const callback = await agent
      .get(`${BASE}/google/callback`)
      .query({ code: 'sub-1|ryan@exemple.test', state });
    const after = (callback.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect(after).not.toBe(before);
  });
});

describe('choix du handle', () => {
  async function pendingAgent(): Promise<Agent> {
    const agent = request.agent(app);
    await signIn(agent, 'sub-1|ryan@exemple.test');
    return agent;
  }

  it('refuse un format invalide avec VALIDATION_ERROR', async () => {
    const agent = await pendingAgent();
    for (const handle of ['ab', 'Mot Passe', 'é-lise', 'a'.repeat(31)]) {
      const res = await agent.post(`${BASE}/handle`).send({ handle });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuse les mots réservés et offensants, casse comprise', async () => {
    const agent = await pendingAgent();
    for (const handle of ['Admin', 'trame', 'FuckYou', 'Sale_Connard']) {
      const res = await agent.post(`${BASE}/handle`).send({ handle });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('HANDLE_NOT_ALLOWED');
    }
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'pending' });
  });

  it('refuse un handle déjà pris, sans tenir compte de la casse', async () => {
    await newAccount('Ryan');
    const agent = request.agent(app);
    await signIn(agent, 'sub-2|autre@exemple.test');
    const res = await agent.post(`${BASE}/handle`).send({ handle: 'RYAN' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HANDLE_TAKEN');
    // L’inscription reste possible avec un autre handle.
    expect((await agent.post(`${BASE}/handle`).send({ handle: 'Autre' })).status).toBe(201);
  });

  it('exige une inscription en attente (SIGNUP_EXPIRED)', async () => {
    const res = await request(app).post(`${BASE}/handle`).send({ handle: 'Ryan' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SIGNUP_EXPIRED');
  });

  it('refuse un corps avec un champ en trop', async () => {
    const agent = await pendingAgent();
    const res = await agent.post(`${BASE}/handle`).send({ handle: 'Ryan', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('abandonner l’inscription ne crée aucun compte', async () => {
    const agent = await pendingAgent();
    const res = await agent.post(`${BASE}/cancel`);
    expect(res.status).toBe(204);
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'anonymous' });
    expect((await client.query('SELECT 1 FROM app_user')).rowCount).toBe(0);
    expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(0);
  });

  it('l’attente expire : le visiteur redevient anonyme', async () => {
    const agent = await pendingAgent();
    await client.query("UPDATE session SET expire = now() - interval '1 second'");
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'anonymous' });
    expect((await agent.post(`${BASE}/handle`).send({ handle: 'Ryan' })).status).toBe(401);
  });
});

describe('connexion d’un compte existant', () => {
  it('connecte directement, sans écran de handle', async () => {
    await newAccount('Ryan');
    const agent = request.agent(app);
    const res = await signIn(agent, 'sub-1|ryan@exemple.test');
    expect(res.headers.location).toBe(`${WEB}/`);
    expect((await agent.get(`${BASE}/me`)).body).toMatchObject({
      status: 'authenticated',
      user: { handle: 'Ryan' },
    });
  });

  it('refuse un compte supprimé', async () => {
    await newAccount('Ryan');
    await client.query('UPDATE app_user SET deleted_at = now()');
    const agent = request.agent(app);
    const res = await signIn(agent, 'sub-1|ryan@exemple.test');
    expect(res.headers.location).toBe(`${WEB}/?auth_error=UNAUTHENTICATED`);
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'anonymous' });
  });

  it('déconnecte une session dont le compte a été supprimé', async () => {
    const agent = await newAccount('Ryan');
    await client.query('UPDATE app_user SET deleted_at = now()');
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'anonymous' });
    expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(0);
  });

  it('expose le rôle admin tel qu’en base', async () => {
    const agent = await newAccount('Ryan');
    await client.query("UPDATE app_user SET role = 'admin'");
    expect((await agent.get(`${BASE}/me`)).body.user.role).toBe('admin');
  });
});

describe('retour de Google en échec', () => {
  it('ramène au front avec un code quand le state ne correspond pas', async () => {
    const agent = request.agent(app);
    await agent.get(`${BASE}/google`);
    const res = await agent
      .get(`${BASE}/google/callback`)
      .query({ code: 'sub-1|a@exemple.test', state: 'autre' });
    expect(res.headers.location).toBe(`${WEB}/?auth_error=AUTH_STATE_INVALID`);
  });

  it('refuse un retour sans connexion démarrée', async () => {
    const res = await request(app)
      .get(`${BASE}/google/callback`)
      .query({ code: 'sub-1|a@exemple.test', state: 'state-1' });
    expect(res.headers.location).toBe(`${WEB}/?auth_error=AUTH_STATE_INVALID`);
  });

  it('refuse de rejouer un retour déjà utilisé', async () => {
    const agent = request.agent(app);
    const start = await agent.get(`${BASE}/google`);
    const state = new URL(start.headers.location as string).searchParams.get('state');
    const query = { code: 'sub-1|a@exemple.test', state };
    expect((await agent.get(`${BASE}/google/callback`).query(query)).headers.location).toBe(
      `${WEB}/signup/handle`,
    );
    expect((await agent.get(`${BASE}/google/callback`).query(query)).headers.location).toBe(
      `${WEB}/?auth_error=AUTH_STATE_INVALID`,
    );
  });

  it('signale un refus de l’utilisateur sur l’écran Google', async () => {
    const agent = request.agent(app);
    await agent.get(`${BASE}/google`);
    const res = await agent.get(`${BASE}/google/callback`).query({ error: 'access_denied' });
    expect(res.headers.location).toBe(`${WEB}/?auth_error=cancelled`);
  });

  it('transmet le code d’erreur quand Google rejette le code d’autorisation', async () => {
    const agent = request.agent(app);
    const res = await signIn(agent, 'refused');
    expect(res.headers.location).toBe(`${WEB}/?auth_error=AUTH_STATE_INVALID`);
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'anonymous' });
  });
});

describe('limitation de débit', () => {
  it('refuse au-delà de la limite avec RATE_LIMITED et Retry-After', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await request(limitedApp).get(`${BASE}/google`)).status).toBe(302);
    }
    const res = await request(limitedApp).get(`${BASE}/google`);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('compte ensemble connexion, retour de Google et choix du handle, mais pas /auth/me', async () => {
    const agent = request.agent(limitedApp);
    await agent.get(`${BASE}/google`);
    await agent.get(`${BASE}/google/callback`).query({ error: 'access_denied' });
    await agent.post(`${BASE}/handle`).send({ handle: 'Ryan' });
    expect((await agent.get(`${BASE}/google`)).status).toBe(429);
    expect((await agent.get(`${BASE}/me`)).status).toBe(200);
  });
});

describe('déconnexion et contrôle d’origine', () => {
  it('détruit la session et efface le cookie', async () => {
    const agent = await newAccount();
    const res = await agent.post(`${BASE}/logout`).set('Origin', WEB);
    expect(res.status).toBe(204);
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^trame\.sid=;/);
    expect((await agent.get(`${BASE}/me`)).body).toEqual({ status: 'anonymous' });
    expect((await client.query('SELECT 1 FROM session')).rowCount).toBe(0);
  });

  it('refuse une requête qui modifie des données depuis une autre origine', async () => {
    const agent = await newAccount();
    const res = await agent.post(`${BASE}/logout`).set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ORIGIN');
    expect((await agent.get(`${BASE}/me`)).body.status).toBe('authenticated');
  });

  it('laisse passer les lectures quelle que soit l’origine', async () => {
    const res = await request(app).get(`${BASE}/me`).set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
  });
});
