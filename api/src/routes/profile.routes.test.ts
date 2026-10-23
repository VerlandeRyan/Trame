import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { AppError } from '../errors.js';
import { libraryPageSchema, profileSchema } from '../openapi/schemas.js';
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
const app = createApp({
  db,
  auth: { google, sessionSecret: 's'.repeat(32), rateLimit: { windowMs: 60_000, limit: 10_000 } },
});

const AUTH = '/api/v1/auth';
const TEST_EMAIL_DOMAIN = '@profile.test';

type Agent = ReturnType<typeof request.agent>;

async function newMember(handle: string): Promise<Agent> {
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

const entryUrl = (workId: number) => `/api/v1/works/${workId}/entry`;
const profileUrl = (handle: string) => `/api/v1/users/${handle}`;

let workIds: number[];

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
  const res = await client.query('SELECT id FROM work ORDER BY id LIMIT 3');
  workIds = res.rows.map((row) => Number(row.id));
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

async function fillList(agent: Agent): Promise<void> {
  const [first, second, third] = workIds;
  await agent.put(entryUrl(first)).send({ status: 'completed', chaptersRead: 12, rating: 9 });
  await agent.put(entryUrl(second)).send({ status: 'reading', volumesRead: 3, rating: 7 });
  await agent.put(entryUrl(third)).send({ status: 'plan_to_read' });
}

describe('GET /users/:handle', () => {
  it('répond NOT_FOUND pour un pseudo inconnu', async () => {
    const res = await request(app).get(profileUrl('personne'));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('refuse un pseudo mal formé', async () => {
    const res = await request(app).get(profileUrl('a'));
    expect(res.status).toBe(400);
  });

  it('montre à un visiteur un profil public, statistiques séparées comprises', async () => {
    const owner = await newMember('lectrice');
    await fillList(owner);

    const res = await request(app).get(profileUrl('Lectrice')).query({ lang: 'fr' });

    expect(res.status).toBe(200);
    expect(profileSchema.safeParse(res.body).error?.issues ?? []).toEqual([]);
    expect(res.body).toMatchObject({ handle: 'lectrice', visibility: 'public', isOwner: false });
    expect(res.body.details.stats).toMatchObject({
      worksFollowed: 3,
      ratingAverage: 8,
      chaptersRead: 12,
      volumesRead: 3,
      statusCounts: { reading: 1, completed: 1, plan_to_read: 1, on_hold: 0, dropped: 0 },
    });
    expect(res.body.details.topRated.map((each: { rating: number }) => each.rating)).toEqual([
      9, 7,
    ]);
    expect(res.body.details.recentUpdates).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toContain(TEST_EMAIL_DOMAIN);
  });

  it('renvoie une moyenne nulle et des listes vides pour une liste vide', async () => {
    await newMember('novice');
    const res = await request(app).get(profileUrl('novice'));
    expect(res.body.details.stats.ratingAverage).toBeNull();
    expect(res.body.details.topRated).toEqual([]);
    expect(res.body.details.recentUpdates).toEqual([]);
  });

  it('n’expose que le pseudo d’un profil privé, sauf à son propriétaire', async () => {
    const owner = await newMember('discrete');
    await fillList(owner);
    const saved = await owner.patch('/api/v1/me/profile').send({ visibility: 'private' });
    expect(saved.body).toEqual({ visibility: 'private' });

    const visitor = await request(app).get(profileUrl('discrete'));
    expect(visitor.body).toEqual({
      handle: 'discrete',
      visibility: 'private',
      isOwner: false,
      details: null,
    });

    const own = await owner.get(profileUrl('discrete'));
    expect(own.body.isOwner).toBe(true);
    expect(own.body.details.stats.worksFollowed).toBe(3);
  });

  it('ignore les œuvres archivées', async () => {
    const owner = await newMember('lectrice');
    await fillList(owner);
    await client.query('UPDATE work SET deleted_at = now() WHERE id = $1', [workIds[0]]);
    try {
      const res = await request(app).get(profileUrl('lectrice'));
      expect(res.body.details.stats.worksFollowed).toBe(2);
      expect(res.body.details.topRated).toHaveLength(1);
    } finally {
      await client.query('UPDATE work SET deleted_at = NULL WHERE id = $1', [workIds[0]]);
    }
  });
});

describe('GET /users/:handle/entries', () => {
  it('liste la liste publique d’un membre à un visiteur', async () => {
    const owner = await newMember('lectrice');
    await fillList(owner);

    const res = await request(app).get(`${profileUrl('lectrice')}/entries`);

    expect(res.status).toBe(200);
    expect(libraryPageSchema.safeParse(res.body).error?.issues ?? []).toEqual([]);
    expect(res.body.total).toBe(3);
  });

  it('refuse la liste d’un profil privé, sauf à son propriétaire', async () => {
    const owner = await newMember('discrete');
    await fillList(owner);
    await owner.patch('/api/v1/me/profile').send({ visibility: 'private' });

    const visitor = await request(app).get(`${profileUrl('discrete')}/entries`);
    expect(visitor.status).toBe(403);
    expect(visitor.body.code).toBe('PROFILE_PRIVATE');

    const own = await owner.get(`${profileUrl('discrete')}/entries`);
    expect(own.status).toBe(200);
  });

  it('répond NOT_FOUND pour un pseudo inconnu', async () => {
    const res = await request(app).get(`${profileUrl('personne')}/entries`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /me/profile', () => {
  it('refuse un visiteur', async () => {
    const res = await request(app).patch('/api/v1/me/profile').send({ visibility: 'private' });
    expect(res.status).toBe(401);
  });

  it('refuse une valeur inconnue', async () => {
    const member = await newMember('lectrice');
    const res = await member.patch('/api/v1/me/profile').send({ visibility: 'friends' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('repasse un profil en public', async () => {
    const member = await newMember('lectrice');
    await member.patch('/api/v1/me/profile').send({ visibility: 'private' });
    await member.patch('/api/v1/me/profile').send({ visibility: 'public' });
    const res = await request(app).get(profileUrl('lectrice'));
    expect(res.body.visibility).toBe('public');
  });
});
