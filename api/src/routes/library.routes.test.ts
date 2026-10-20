import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { AppError } from '../errors.js';
import type { GoogleClient } from '../services/google-identity.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const seed = readFileSync(new URL('../../../db/demo-data.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });
const db = createDb(connectionString);

/** Doublure de Google : le « code » vaut `sub|email`. */
const google: GoogleClient = {
  async start() {
    return {
      url: 'https://accounts.example/auth?state=s',
      state: 's',
      codeVerifier: 'v',
      nonce: 'n',
    };
  },
  async verify(code) {
    if (code === 'refused') throw new AppError('AUTH_STATE_INVALID');
    const [sub, email] = code.split('|');
    return { sub, email };
  },
};
// Les tests enchaînent bien plus de connexions que la limite réelle : on la relève.
const app = createApp({
  db,
  auth: { google, sessionSecret: 's'.repeat(32), rateLimit: { windowMs: 60_000, limit: 10_000 } },
});

const AUTH = '/api/v1/auth';
const TEST_EMAIL_DOMAIN = '@library.test';

type Agent = ReturnType<typeof request.agent>;

async function newReader(handle: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.get(`${AUTH}/google`);
  await agent.get(`${AUTH}/google/callback`).query({
    code: `sub-${handle}|${handle}${TEST_EMAIL_DOMAIN}`,
    state: 's',
  });
  const res = await agent.post(`${AUTH}/handle`).send({ handle });
  expect(res.status).toBe(201);
  return agent;
}

async function idOf(title: string): Promise<number> {
  const res = await client.query('SELECT id FROM work WHERE title = $1', [title]);
  return Number(res.rows[0].id);
}

const entryUrl = (workId: number) => `/api/v1/works/${workId}/entry`;

let workId: number;

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
  workId = await idOf('Les Lanternes de Brume');
});

afterAll(async () => {
  await client.end();
  await db.destroy();
});

beforeEach(async () => {
  const testUsers = `SELECT id FROM app_user WHERE email LIKE '%${TEST_EMAIL_DOMAIN}'`;
  await client.query(`DELETE FROM reading_event WHERE user_id IN (${testUsers})`);
  await client.query(`DELETE FROM library_entry WHERE user_id IN (${testUsers})`);
  await client.query(`DELETE FROM app_user WHERE email LIKE '%${TEST_EMAIL_DOMAIN}'`);
  await client.query('TRUNCATE session');
});

describe('accès', () => {
  it('refuse un visiteur', async () => {
    for (const call of [
      request(app).get(entryUrl(workId)),
      request(app).put(entryUrl(workId)).send({ status: 'reading' }),
      request(app).delete(entryUrl(workId)),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    }
  });
});

describe('GET /works/:id/entry', () => {
  it('renvoie null tant que l’œuvre n’est pas dans la liste', async () => {
    const agent = await newReader('lectrice');
    const res = await agent.get(entryUrl(workId));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ entry: null });
  });

  it('répond NOT_FOUND pour une œuvre inconnue', async () => {
    const agent = await newReader('lectrice');
    const res = await agent.get(entryUrl(999_999));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('répond NOT_FOUND pour une œuvre archivée', async () => {
    const agent = await newReader('lectrice');
    await client.query('UPDATE work SET deleted_at = now() WHERE id = $1', [workId]);
    try {
      const res = await agent.get(entryUrl(workId));
      expect(res.status).toBe(404);
    } finally {
      await client.query('UPDATE work SET deleted_at = NULL WHERE id = $1', [workId]);
    }
  });
});

describe('PUT /works/:id/entry', () => {
  it('ajoute à la liste, puis relit la même entrée', async () => {
    const agent = await newReader('lectrice');
    const created = await agent.put(entryUrl(workId)).send({ status: 'plan_to_read' });
    expect(created.status).toBe(200);
    expect(created.body.entry).toMatchObject({
      status: 'plan_to_read',
      chaptersRead: 0,
      volumesRead: 0,
      rating: null,
    });
    const read = await agent.get(entryUrl(workId));
    expect(read.body).toEqual(created.body);
  });

  it('met à jour les compteurs indépendamment et journalise', async () => {
    const agent = await newReader('lectrice');
    await agent.put(entryUrl(workId)).send({ status: 'reading', chaptersRead: 5 });
    const res = await agent.put(entryUrl(workId)).send({ status: 'reading', volumesRead: 2 });
    expect(res.body.entry).toMatchObject({ chaptersRead: 5, volumesRead: 2 });

    const events = await client.query(
      `SELECT kind, chapters_added, volumes_added, new_status FROM reading_event
       WHERE work_id = $1 AND user_id IN (SELECT id FROM app_user WHERE handle = 'lectrice')
       ORDER BY id`,
      [workId],
    );
    expect(events.rows).toEqual([
      { kind: 'status', chapters_added: null, volumes_added: null, new_status: 'reading' },
      { kind: 'chapters', chapters_added: 5, volumes_added: null, new_status: null },
      { kind: 'volumes', chapters_added: null, volumes_added: 2, new_status: null },
    ]);
  });

  it('note puis retire la note', async () => {
    const agent = await newReader('lectrice');
    const rated = await agent.put(entryUrl(workId)).send({ status: 'completed', rating: 9 });
    expect(rated.body.entry.rating).toBe(9);
    const cleared = await agent.put(entryUrl(workId)).send({ status: 'completed', rating: null });
    expect(cleared.body.entry.rating).toBeNull();
  });

  it('garde une entrée par lecteur', async () => {
    const first = await newReader('premier');
    const second = await newReader('second');
    await first.put(entryUrl(workId)).send({ status: 'reading', chaptersRead: 4 });
    const res = await second.get(entryUrl(workId));
    expect(res.body).toEqual({ entry: null });
  });

  it.each([
    ['statut inconnu', { status: 'finished' }],
    ['statut absent', { chaptersRead: 1 }],
    ['compteur négatif', { status: 'reading', chaptersRead: -1 }],
    ['compteur décimal', { status: 'reading', volumesRead: 1.5 }],
    ['note au-dessus de 10', { status: 'reading', rating: 11 }],
    ['note à 0', { status: 'reading', rating: 0 }],
    ['note négative', { status: 'reading', rating: -1 }],
    ['note décimale', { status: 'reading', rating: 7.5 }],
    ['date invalide', { status: 'reading', startedOn: '2026-13-40' }],
    ['champ inconnu', { status: 'reading', favorite: true }],
  ])('refuse : %s', async (_label, body) => {
    const agent = await newReader('lectrice');
    const res = await agent.put(entryUrl(workId)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un identifiant d’œuvre invalide', async () => {
    const agent = await newReader('lectrice');
    const res = await agent.put('/api/v1/works/abc/entry').send({ status: 'reading' });
    expect(res.status).toBe(400);
  });

  it('répond NOT_FOUND pour une œuvre inconnue', async () => {
    const agent = await newReader('lectrice');
    const res = await agent.put(entryUrl(999_999)).send({ status: 'reading' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /works/:id/entry', () => {
  it('retire l’entrée, et reste sans effet si elle est déjà absente', async () => {
    const agent = await newReader('lectrice');
    await agent.put(entryUrl(workId)).send({ status: 'reading' });
    expect((await agent.delete(entryUrl(workId))).status).toBe(204);
    expect((await agent.get(entryUrl(workId))).body).toEqual({ entry: null });
    expect((await agent.delete(entryUrl(workId))).status).toBe(204);
  });

  it('conserve le journal de lecture', async () => {
    const agent = await newReader('lectrice');
    await agent.put(entryUrl(workId)).send({ status: 'reading' });
    await agent.delete(entryUrl(workId));
    const events = await client.query(
      `SELECT count(*)::int AS n FROM reading_event
       WHERE user_id IN (SELECT id FROM app_user WHERE handle = 'lectrice')`,
    );
    expect(events.rows[0].n).toBe(1);
  });
});
