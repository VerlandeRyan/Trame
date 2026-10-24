import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { AppError } from '../errors.js';
import {
  adminPersonPageSchema,
  adminPersonSchema,
  adminPublisherSchema,
  adminWorkPageSchema,
  adminWorkSchema,
} from '../openapi/admin-schemas.js';
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
  adminRateLimit: { windowMs: 60_000, limit: 10_000 },
});

const AUTH = '/api/v1/auth';
const ADMIN = '/api/v1/admin';
const TEST_EMAIL_DOMAIN = '@admin-catalogue.test';
/** Préfixe des fiches créées ici, pour les retirer sans toucher au jeu de démo. */
const PREFIX = 'ZZ Admin test';

type Agent = ReturnType<typeof request.agent>;

async function signUp(handle: string): Promise<Agent> {
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

async function newAdmin(): Promise<Agent> {
  const agent = await signUp('admin-test');
  await client.query(`UPDATE app_user SET role = 'admin' WHERE handle = 'admin-test'`);
  return agent;
}

const expectMatches = (schema: z.ZodType, body: unknown) => {
  expect(schema.safeParse(body).error?.issues ?? []).toEqual([]);
};

function workBody(overrides: Record<string, unknown> = {}) {
  return {
    title: `${PREFIX} Œuvre`,
    originalLanguage: 'fr',
    type: 'series',
    status: 'completed',
    chapters: 12,
    volumes: 3,
    startedOn: '2020-01-01',
    endedOn: '2021-06-30',
    ...overrides,
  };
}

async function createPerson(admin: Agent, name = `${PREFIX} Personne`): Promise<number> {
  const res = await admin.post(`${ADMIN}/people`).send({ name, kind: 'person' });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function createPublisher(admin: Agent, name = `${PREFIX} Éditeur`): Promise<number> {
  const res = await admin.post(`${ADMIN}/publishers`).send({ name, kind: 'publisher' });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function createWork(admin: Agent, overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await admin.post(`${ADMIN}/works`).send(workBody(overrides));
  expect(res.status).toBe(201);
  return res.body.id;
}

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
});

afterAll(async () => {
  await client.end();
  await db.destroy();
});

beforeEach(async () => {
  await client.query(
    `DELETE FROM library_entry WHERE user_id IN (SELECT id FROM app_user WHERE email LIKE '%${TEST_EMAIL_DOMAIN}')`,
  );
  await client.query(`DELETE FROM work WHERE title LIKE '${PREFIX}%'`);
  await client.query(`DELETE FROM person WHERE name LIKE '${PREFIX}%'`);
  await client.query(`DELETE FROM publisher WHERE name LIKE '${PREFIX}%'`);
  await client.query(`DELETE FROM app_user WHERE email LIKE '%${TEST_EMAIL_DOMAIN}'`);
  await client.query('TRUNCATE session');
});

describe('accès', () => {
  const calls = [
    (agent: Agent) => agent.get(`${ADMIN}/people`),
    (agent: Agent) => agent.get(`${ADMIN}/publishers/1`),
    (agent: Agent) => agent.get(`${ADMIN}/works`),
    (agent: Agent) => agent.post(`${ADMIN}/people`).send({ name: 'x', kind: 'person' }),
    (agent: Agent) => agent.post(`${ADMIN}/works/1/archive`),
  ];

  it('refuse un visiteur', async () => {
    for (const call of calls) {
      const res = await call(request.agent(app));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    }
  });

  it('refuse un membre qui n’est pas administrateur', async () => {
    const member = await signUp('membre-test');
    for (const call of calls) {
      const res = await call(member);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ADMIN_REQUIRED');
    }
  });

  it('refuse une écriture venue d’un autre site', async () => {
    const admin = await newAdmin();
    const res = await admin
      .post(`${ADMIN}/people`)
      .set('Origin', 'https://autre.example')
      .send({ name: `${PREFIX} X`, kind: 'person' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ORIGIN');
  });
});

describe('écritures', () => {
  it.each(['people', 'publishers', 'works'])('refuse un corps invalide sur /%s', async (path) => {
    const admin = await newAdmin();
    const created = await admin.post(`${ADMIN}/${path}`).send({});
    expect(created.status).toBe(400);
    expect(created.body.code).toBe('VALIDATION_ERROR');
    const replaced = await admin.put(`${ADMIN}/${path}/1`).send({ inconnu: true });
    expect(replaced.status).toBe(400);
    expect(replaced.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('pagination', () => {
  it('donne le total même au-delà de la dernière page', async () => {
    const admin = await newAdmin();
    for (const name of ['A', 'B', 'C']) await createPerson(admin, `${PREFIX} ${name}`);

    const inside = await admin.get(`${ADMIN}/people`).query({ q: PREFIX, pageSize: 2 });
    expect(inside.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(inside.body.items).toHaveLength(2);

    const beyond = await admin.get(`${ADMIN}/people`).query({ q: PREFIX, pageSize: 2, page: 9 });
    expect(beyond.body).toMatchObject({ items: [], page: 9, total: 3 });

    const none = await admin.get(`${ADMIN}/people`).query({ q: 'zzz introuvable' });
    expect(none.body).toMatchObject({ items: [], total: 0 });
  });
});

describe('personnes', () => {
  it('crée, lit, remplace et liste', async () => {
    const admin = await newAdmin();
    const created = await admin.post(`${ADMIN}/people`).send({
      name: `${PREFIX} Léa`,
      kind: 'person',
      links: [{ kind: 'website', url: 'https://exemple.test/lea' }],
    });
    expect(created.status).toBe(201);
    expectMatches(adminPersonSchema, created.body);
    expect(created.body).toMatchObject({
      archived: false,
      activeWorkCount: 0,
      links: [{ kind: 'website', url: 'https://exemple.test/lea', label: null }],
    });

    const id = created.body.id;
    const replaced = await admin
      .put(`${ADMIN}/people/${id}`)
      .send({ name: `${PREFIX} Léa M.`, kind: 'collective' });
    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({
      name: `${PREFIX} Léa M.`,
      kind: 'collective',
      links: [],
    });

    const list = await admin.get(`${ADMIN}/people`).query({ q: 'lea m' });
    expectMatches(adminPersonPageSchema, list.body);
    expect(list.body.items.map((p: { id: number }) => p.id)).toEqual([id]);
    expect((await admin.get(`${ADMIN}/people/${id}`)).body.name).toBe(`${PREFIX} Léa M.`);
  });

  it('refuse un lien qui n’est pas en https', async () => {
    const admin = await newAdmin();
    const res = await admin.post(`${ADMIN}/people`).send({
      name: `${PREFIX} Lien`,
      kind: 'person',
      links: [{ kind: 'website', url: 'http://exemple.test' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un lien de lecture ou d’achat sur une personne', async () => {
    const admin = await newAdmin();
    const res = await admin.post(`${ADMIN}/people`).send({
      name: `${PREFIX} Lien lire`,
      kind: 'person',
      links: [{ kind: 'read', url: 'https://exemple.test' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('répond 404 pour une personne inconnue', async () => {
    const admin = await newAdmin();
    expect((await admin.get(`${ADMIN}/people/999999999`)).body.code).toBe('NOT_FOUND');
    const put = await admin.put(`${ADMIN}/people/999999999`).send({ name: 'x', kind: 'person' });
    expect(put.status).toBe(404);
  });

  it('archive et restaure, sauf si elle est créditée sur une œuvre non archivée', async () => {
    const admin = await newAdmin();
    const personId = await createPerson(admin);
    const workId = await createWork(admin, { credits: [{ personId, role: 'story' }] });

    const refused = await admin.post(`${ADMIN}/people/${personId}/archive`);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('PERSON_HAS_WORKS');

    await admin.post(`${ADMIN}/works/${workId}/archive`);
    const archived = await admin.post(`${ADMIN}/people/${personId}/archive`);
    expect(archived.status).toBe(200);
    expect(archived.body.archived).toBe(true);

    const active = await admin.get(`${ADMIN}/people`).query({ q: PREFIX });
    expect(active.body.items).toEqual([]);
    const onlyArchived = await admin.get(`${ADMIN}/people`).query({ q: PREFIX, scope: 'archived' });
    expect(onlyArchived.body.items.map((p: { id: number }) => p.id)).toEqual([personId]);

    const restored = await admin.post(`${ADMIN}/people/${personId}/restore`);
    expect(restored.body.archived).toBe(false);
  });
});

describe('éditeurs', () => {
  it('crée, remplace et archive', async () => {
    const admin = await newAdmin();
    const created = await admin.post(`${ADMIN}/publishers`).send({
      name: `${PREFIX} Maison`,
      kind: 'platform',
      url: 'https://exemple.test',
    });
    expect(created.status).toBe(201);
    expectMatches(adminPublisherSchema, created.body);

    const id = created.body.id;
    const replaced = await admin
      .put(`${ADMIN}/publishers/${id}`)
      .send({ name: `${PREFIX} Maison 2`, kind: 'self_published' });
    expect(replaced.body).toMatchObject({ kind: 'self_published', url: null });

    const archived = await admin.post(`${ADMIN}/publishers/${id}/archive`);
    expect(archived.body.archived).toBe(true);
  });

  it('refuse d’archiver un éditeur qui a des œuvres non archivées', async () => {
    const admin = await newAdmin();
    const publisherId = await createPublisher(admin);
    const workId = await createWork(admin, { publisherIds: [publisherId] });

    const refused = await admin.post(`${ADMIN}/publishers/${publisherId}/archive`);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('PUBLISHER_HAS_WORKS');

    await admin.post(`${ADMIN}/works/${workId}/archive`);
    expect((await admin.post(`${ADMIN}/publishers/${publisherId}/archive`)).status).toBe(200);
  });
});

describe('œuvres', () => {
  it('crée une fiche complète puis la relit à l’identique', async () => {
    const admin = await newAdmin();
    const personId = await createPerson(admin);
    const publisherId = await createPublisher(admin);
    const relatedId = await createWork(admin, { title: `${PREFIX} Liée` });
    const body = workBody({
      titles: [{ language: 'en', kind: 'international', title: `${PREFIX} Work` }],
      synopses: [{ language: 'fr', text: 'Un résumé.', source: 'official' }],
      credits: [{ personId, role: 'story' }],
      publisherIds: [publisherId],
      genres: ['fantasy', 'manga'],
      relations: [{ relatedWorkId: relatedId, relation: 'sequel' }],
      links: [{ kind: 'read', url: 'https://exemple.test/lire', label: 'Lire' }],
    });

    const created = await admin.post(`${ADMIN}/works`).send(body);
    expect(created.status).toBe(201);
    expectMatches(adminWorkSchema, created.body);
    expect(created.body).toMatchObject({ ...body, genres: ['fantasy', 'manga'], archived: false });

    const read = await admin.get(`${ADMIN}/works/${created.body.id}`);
    expect(read.body).toEqual(created.body);
  });

  it('donne le nombre de membres qui suivent l’œuvre', async () => {
    const admin = await newAdmin();
    const id = await createWork(admin);
    const before = await admin.get(`${ADMIN}/works/${id}`);
    expect(before.body.followerCount).toBe(0);

    await client.query(
      `INSERT INTO library_entry (user_id, work_id, status)
       SELECT id, $1, 'reading' FROM app_user WHERE handle = 'admin-test'`,
      [id],
    );

    const after = await admin.get(`${ADMIN}/works/${id}`);
    expectMatches(adminWorkSchema, after.body);
    expect(after.body.followerCount).toBe(1);
  });

  it('remplace les listes de la fiche', async () => {
    const admin = await newAdmin();
    const personId = await createPerson(admin);
    const id = await createWork(admin, {
      credits: [{ personId, role: 'story' }],
      genres: ['manga'],
      links: [{ kind: 'read', url: 'https://exemple.test/a' }],
    });

    const res = await admin.put(`${ADMIN}/works/${id}`).send(workBody({ title: `${PREFIX} Neuf` }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: `${PREFIX} Neuf`,
      credits: [],
      genres: [],
      links: [],
    });
  });

  it.each([
    ['totaux d’une œuvre en cours', { status: 'ongoing', chapters: 5 }],
    ['fin avant le début', { startedOn: '2021-01-01', endedOn: '2020-01-01' }],
    ['langue mal formée', { originalLanguage: 'Français' }],
    [
      'relation en double vers une même œuvre',
      {
        relations: [
          { relatedWorkId: 1, relation: 'sequel' },
          { relatedWorkId: 1, relation: 'spin_off' },
        ],
      },
    ],
    [
      'lien de site ou de réseau social sur une œuvre',
      { links: [{ kind: 'website', url: 'https://exemple.test' }] },
    ],
    [
      'titre alternatif en double',
      {
        titles: [
          { language: 'en', kind: 'international', title: 'Same' },
          { language: 'en', kind: 'short', title: 'Same' },
        ],
      },
    ],
    [
      'même personne créditée deux fois dans le même rôle',
      {
        credits: [
          { personId: 1, role: 'story' },
          { personId: 1, role: 'story' },
        ],
      },
    ],
    ['éditeur en double', { publisherIds: [1, 1] }],
    ['genre en double', { genres: ['manga', 'manga'] }],
    [
      'synopsis en double dans une langue',
      {
        synopses: [
          { language: 'fr', text: 'a', source: 'official' },
          { language: 'fr', text: 'b', source: 'human' },
        ],
      },
    ],
  ])('refuse : %s', async (_label, overrides) => {
    const admin = await newAdmin();
    const res = await admin.post(`${ADMIN}/works`).send(workBody(overrides));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('accepte une œuvre en cours sans totaux', async () => {
    const admin = await newAdmin();
    const res = await admin
      .post(`${ADMIN}/works`)
      .send(workBody({ status: 'ongoing', chapters: null, volumes: null, endedOn: null }));
    expect(res.status).toBe(201);
  });

  it('refuse une référence inexistante ou l’œuvre elle-même', async () => {
    const admin = await newAdmin();
    const unknown = await admin.post(`${ADMIN}/works`).send(
      workBody({
        credits: [{ personId: 999999999, role: 'art' }],
        publisherIds: [999999999],
        genres: ['inconnu'],
        relations: [{ relatedWorkId: 999999999, relation: 'other' }],
      }),
    );
    expect(unknown.status).toBe(400);
    expect(unknown.body).toMatchObject({
      code: 'INVALID_REFERENCE',
      details: {
        personIds: [999999999],
        publisherIds: [999999999],
        workIds: [999999999],
        genres: ['inconnu'],
      },
    });

    const id = await createWork(admin);
    const self = await admin
      .put(`${ADMIN}/works/${id}`)
      .send(workBody({ relations: [{ relatedWorkId: id, relation: 'other' }] }));
    expect(self.body.code).toBe('INVALID_REFERENCE');
  });

  it('refuse de citer une fiche archivée, sauf si l’œuvre la cite déjà', async () => {
    const admin = await newAdmin();
    const personId = await createPerson(admin);
    const publisherId = await createPublisher(admin);
    const citingId = await createWork(admin, {
      title: `${PREFIX} Cite`,
      credits: [{ personId, role: 'story' }],
      publisherIds: [publisherId],
    });
    await admin.post(`${ADMIN}/works/${citingId}/archive`);
    await admin.post(`${ADMIN}/people/${personId}/archive`);
    await admin.post(`${ADMIN}/publishers/${publisherId}/archive`);

    const cited = { credits: [{ personId, role: 'art' }], publisherIds: [publisherId] };
    const refused = await admin.post(`${ADMIN}/works`).send(workBody(cited));
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({
      code: 'ARCHIVED_REFERENCE',
      details: { personIds: [personId], publisherIds: [publisherId], workIds: [] },
    });
    const relation = { relations: [{ relatedWorkId: citingId, relation: 'other' }] };
    const related = await admin.post(`${ADMIN}/works`).send(workBody(relation));
    expect(related.body.code).toBe('ARCHIVED_REFERENCE');

    const kept = await admin.put(`${ADMIN}/works/${citingId}`).send(
      workBody({
        title: `${PREFIX} Cite`,
        credits: [{ personId, role: 'story' }],
        publisherIds: [publisherId],
      }),
    );
    expect(kept.status).toBe(200);
  });

  it('refuse d’écraser une fiche modifiée entre-temps', async () => {
    const admin = await newAdmin();
    const id = await createWork(admin);
    const { updatedAt } = (await admin.get(`${ADMIN}/works/${id}`)).body;
    expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);

    const first = await admin
      .put(`${ADMIN}/works/${id}`)
      .send(workBody({ title: `${PREFIX} Première`, updatedAt }));
    expect(first.status).toBe(200);
    expect(first.body.updatedAt).not.toBe(updatedAt);

    const second = await admin
      .put(`${ADMIN}/works/${id}`)
      .send(workBody({ title: `${PREFIX} Seconde`, updatedAt }));
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('STALE_RECORD');
    expect((await admin.get(`${ADMIN}/works/${id}`)).body.title).toBe(`${PREFIX} Première`);

    const renewed = await admin
      .put(`${ADMIN}/works/${id}`)
      .send(workBody({ title: `${PREFIX} Seconde`, updatedAt: first.body.updatedAt }));
    expect(renewed.status).toBe(200);
  });

  it('archive (qui, quand) puis restaure, et masque l’œuvre au public', async () => {
    const admin = await newAdmin();
    const id = await createWork(admin);
    expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(200);

    const archived = await admin.post(`${ADMIN}/works/${id}/archive`);
    expect(archived.body.archived).toBe(true);
    const row = await client.query(
      `SELECT w.deleted_at, u.handle FROM work w JOIN app_user u ON u.id = w.deleted_by WHERE w.id = $1`,
      [id],
    );
    expect(row.rows[0].handle).toBe('admin-test');
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(404);

    const again = await admin.post(`${ADMIN}/works/${id}/archive`);
    expect(again.body.archived).toBe(true);

    const restored = await admin.post(`${ADMIN}/works/${id}/restore`);
    expect(restored.body.archived).toBe(false);
    expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(200);
    const cleared = await client.query('SELECT deleted_by FROM work WHERE id = $1', [id]);
    expect(cleared.rows[0].deleted_by).toBeNull();
  });

  it('liste selon la portée et la recherche', async () => {
    const admin = await newAdmin();
    const kept = await createWork(admin, { title: `${PREFIX} Gardée` });
    const gone = await createWork(admin, { title: `${PREFIX} Archivée` });
    await admin.post(`${ADMIN}/works/${gone}/archive`);

    const ids = async (scope: string) => {
      const res = await admin.get(`${ADMIN}/works`).query({ q: PREFIX, scope });
      expectMatches(adminWorkPageSchema, res.body);
      return res.body.items.map((w: { id: number }) => w.id);
    };
    expect(await ids('active')).toEqual([kept]);
    expect(await ids('archived')).toEqual([gone]);
    expect(await ids('all')).toEqual([gone, kept]);
  });

  describe('tri et filtres de la liste', () => {
    async function seedWorks(admin: Agent) {
      const personId = await createPerson(admin, `${PREFIX} Dessinatrice`);
      const complete = await createWork(admin, {
        title: `${PREFIX} B complète`,
        type: 'series',
        status: 'completed',
        credits: [{ personId, role: 'art' }],
        genres: ['manga'],
        synopses: [{ language: 'fr', text: 'Résumé.', source: 'official' }],
        links: [{ kind: 'read', url: 'https://exemple.test/b' }],
      });
      const bare = await createWork(admin, {
        title: `${PREFIX} A nue`,
        type: 'oneshot',
        status: 'completed',
        genres: ['webtoon'],
      });
      const ongoing = await createWork(admin, {
        title: `${PREFIX} C en cours`,
        status: 'ongoing',
        chapters: null,
        volumes: null,
        endedOn: null,
        genres: ['manga'],
      });
      return { complete, bare, ongoing };
    }

    const ids = async (admin: Agent, query: Record<string, string>) => {
      const res = await admin.get(`${ADMIN}/works`).query({ q: PREFIX, ...query });
      expect(res.status).toBe(200);
      return res.body.items.map((work: { id: number }) => work.id);
    };

    it('trie de A à Z, de Z à A, et par complétude', async () => {
      const admin = await newAdmin();
      const { complete, bare, ongoing } = await seedWorks(admin);

      expect(await ids(admin, {})).toEqual([bare, complete, ongoing]);
      expect(await ids(admin, { sort: 'title_desc' })).toEqual([ongoing, complete, bare]);
      expect((await ids(admin, { sort: 'completeness_desc' }))[0]).toBe(complete);
      expect((await ids(admin, { sort: 'completeness' })).at(-1)).toBe(complete);
    });

    it('filtre par type, statut et format, filtres combinés en ET ; q cherche aussi l’auteur', async () => {
      const admin = await newAdmin();
      const { complete, bare, ongoing } = await seedWorks(admin);

      expect(await ids(admin, { type: 'oneshot' })).toEqual([bare]);
      expect(await ids(admin, { status: 'ongoing' })).toEqual([ongoing]);
      expect(await ids(admin, { status: 'ongoing,completed' })).toHaveLength(3);
      expect(await ids(admin, { format: 'manga' })).toEqual([complete, ongoing]);
      expect(await ids(admin, { format: 'webtoon,manga' })).toHaveLength(3);
      expect(await ids(admin, { q: 'dessinat' })).toEqual([complete]);
      expect(await ids(admin, { format: 'manga', status: 'completed' })).toEqual([complete]);
    });

    it('refuse une valeur de filtre ou de tri inconnue', async () => {
      const admin = await newAdmin();
      for (const query of [
        { type: 'novel' },
        { status: 'x' },
        { sort: 'random' },
        { format: 'A B' },
      ]) {
        const res = await admin.get(`${ADMIN}/works`).query(query);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  it('résume chaque ligne : format, auteur, complétude, et qui a archivé', async () => {
    const admin = await newAdmin();
    const personId = await createPerson(admin);
    const id = await createWork(admin, {
      credits: [{ personId, role: 'story' }],
      genres: ['manga', 'fantasy'],
      synopses: [{ language: 'fr', text: 'Un résumé.', source: 'official' }],
      links: [{ kind: 'read', url: 'https://exemple.test/lire' }],
    });

    const read = async (scope: string) =>
      (await admin.get(`${ADMIN}/works`).query({ q: PREFIX, scope })).body.items[0];
    expect(await read('active')).toMatchObject({
      id,
      formats: ['manga'],
      mainAuthor: `${PREFIX} Personne`,
      completeness: 50,
      archivedAt: null,
      archivedBy: null,
    });

    await admin.post(`${ADMIN}/works/${id}/archive`);
    const archived = await read('archived');
    expect(archived.archivedBy).toBe('admin-test');
    expect(archived.archivedAt).not.toBeNull();
  });

  it('répond 404 pour une œuvre inconnue et 400 pour un identifiant invalide', async () => {
    const admin = await newAdmin();
    expect((await admin.get(`${ADMIN}/works/999999999`)).status).toBe(404);
    expect((await admin.get(`${ADMIN}/works/abc`)).status).toBe(400);
  });
});
