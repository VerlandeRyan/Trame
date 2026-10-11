import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/database.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquante (voir .env.example)');
}

const seed = readFileSync(new URL('../../db/demo-data.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });
const db = createDb(connectionString);
const app = createApp({ db });

interface Item {
  id: number;
  title: string;
  mainAuthor: string | null;
  coverPath: string | null;
}

async function titles(query: string): Promise<string[]> {
  const res = await request(app).get(`/api/v1/works${query}`);
  expect(res.status).toBe(200);
  return (res.body.items as Item[]).map((i) => i.title);
}

async function idOf(title: string): Promise<number> {
  const res = await client.query('SELECT id FROM work WHERE title = $1', [title]);
  return Number(res.rows[0].id);
}

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
});

afterAll(async () => {
  await client.end();
  await db.destroy();
});

describe('GET /api/v1/works', () => {
  it('liste les œuvres non archivées avec pagination par défaut', async () => {
    const res = await request(app).get('/api/v1/works');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 10 });
    expect(res.body.items).toHaveLength(10);
  });

  it('pagine et renvoie le total complet', async () => {
    const page2 = await request(app).get('/api/v1/works?page=2&pageSize=3');
    expect(page2.body).toMatchObject({ page: 2, pageSize: 3, total: 10 });
    expect(page2.body.items).toHaveLength(3);
    const page4 = await request(app).get('/api/v1/works?page=4&pageSize=3');
    expect(page4.body.items).toHaveLength(1);
  });

  it('filtre par type, statut et genre', async () => {
    expect(await titles('?type=collection')).toEqual(['Basalte – Le Recueil des Braises']);
    expect(await titles('?status=completed')).toHaveLength(4);
    expect((await titles('?genre=BD')).sort()).toEqual(['Cap sur les Archipels', 'Carnet de Colportage']);
  });

  it('cherche sans tenir compte de la casse ni des accents', async () => {
    expect(await titles('?q=etoile')).toHaveLength(3);
    expect(await titles('?q=%C3%89TOILE')).toHaveLength(3);
  });

  it('tolère une faute de frappe légère', async () => {
    expect(await titles('?q=lanterns')).toContain('Les Lanternes de Brume');
  });

  it('cherche dans les titres alternatifs, les auteurs et les éditeurs', async () => {
    expect(await titles('?q=fog%20lanterns')).toEqual(['Les Lanternes de Brume']);
    const byAuthor = await request(app).get('/api/v1/works?q=vasseur');
    expect(byAuthor.body.items).toHaveLength(1);
    expect(byAuthor.body.items[0]).toMatchObject({
      title: 'Les Lanternes de Brume',
      mainAuthor: 'Mélodie Vasseur',
    });
    expect(await titles('?q=marais%20bleu')).toHaveLength(6);
  });

  it('classe d’abord les titres les plus proches', async () => {
    const found = await titles('?q=Etoile%20Vagabonde');
    expect(found[0]).toBe('Étoile Vagabonde');
  });

  it('ne traite pas % et _ comme des jokers', async () => {
    expect(await titles('?q=%25%25')).toEqual([]);
    expect(await titles('?q=__')).toEqual([]);
  });

  it('reste inoffensif face à une saisie hostile', async () => {
    const hostile = "'); DROP TABLE work; --";
    expect(await titles(`?q=${encodeURIComponent(hostile)}`)).toEqual([]);
    const res = await client.query('SELECT count(*) AS n FROM work');
    expect(Number(res.rows[0].n)).toBe(10);
  });

  it('refuse les paramètres invalides', async () => {
    for (const query of ['?q=a', '?pageSize=51', '?page=0', '?type=inconnu', '?status=lu', '?q=ab&q=cd']) {
      const res = await request(app).get(`/api/v1/works${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('n’expose la couverture qu’avec l’accord enregistré', async () => {
    const id = await idOf('Carnet de Colportage');
    await client.query("UPDATE work SET cover_path = 'covers/test.webp', cover_consent = false WHERE id = $1", [id]);
    const without = await request(app).get('/api/v1/works?q=colportage');
    expect(without.body.items[0].coverPath).toBeNull();
    await client.query('UPDATE work SET cover_consent = true WHERE id = $1', [id]);
    const withConsent = await request(app).get('/api/v1/works?q=colportage');
    expect(withConsent.body.items[0].coverPath).toBe('covers/test.webp');
    const detail = await request(app).get(`/api/v1/works/${id}`);
    expect(detail.body.coverPath).toBe('covers/test.webp');
    await client.query('UPDATE work SET cover_path = NULL, cover_consent = false WHERE id = $1', [id]);
  });
});

describe('GET /api/v1/works/:id', () => {
  it('renvoie la fiche complète d’une série en cours', async () => {
    const id = await idOf('Chroniques de Basalte');
    const res = await request(app).get(`/api/v1/works/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      title: 'Chroniques de Basalte',
      type: 'series',
      status: 'ongoing',
      chapters: null,
      volumes: null,
      startedOn: '2021-01-15',
      endedOn: null,
      alternativeTitles: ['Basalte'],
      genres: ['fantasy', 'manga'],
    });
    expect(res.body.credits).toEqual([
      { personId: expect.any(Number), name: 'Théo Marchand', kind: 'person', roles: ['story', 'art'] },
    ]);
    expect(res.body.publishers).toEqual([
      { id: expect.any(Number), name: 'Éditions Marais Bleu (fictives)', kind: 'publisher', url: expect.stringContaining('https://') },
    ]);
    // Relations stockées dans un seul sens : ici, uniquement des relations entrantes.
    expect(res.body.relations).toHaveLength(2);
    for (const r of res.body.relations) expect(r.direction).toBe('incoming');
    expect(res.body.relations.map((r: { relation: string }) => r.relation).sort()).toEqual(['shared_universe', 'spin_off']);
  });

  it('renvoie les totaux, les liens et les relations sortantes', async () => {
    const lanternes = await request(app).get(`/api/v1/works/${await idOf('Les Lanternes de Brume')}`);
    expect(lanternes.body).toMatchObject({ chapters: 120, volumes: 3, endedOn: '2023-06-30' });
    expect(lanternes.body.links.map((l: { kind: string }) => l.kind)).toEqual(['buy', 'read']);

    const recueil = await request(app).get(`/api/v1/works/${await idOf('Basalte – Le Recueil des Braises')}`);
    const outgoing = recueil.body.relations.filter((r: { direction: string }) => r.direction === 'outgoing');
    expect(outgoing.map((r: { relation: string }) => r.relation).sort()).toEqual(['contains', 'shared_universe']);
  });

  it('trie les personnes crédités par rôle le plus important, puis par nom', async () => {
    const res = await request(app).get(`/api/v1/works/${await idOf('Basalte – Histoires de Cendre')}`);
    // Par nom seul, Léa Fontaine passerait avant Théo Marchand : l'ordre vient du rôle.
    expect(res.body.credits.map((c: { name: string; roles: string[] }) => [c.name, c.roles])).toEqual([
      ['Théo Marchand', ['story']],
      ['Léa Fontaine', ['art']],
    ]);
  });

  it('répond 404 pour un identifiant inconnu', async () => {
    const res = await request(app).get('/api/v1/works/999999');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('répond 400 pour un identifiant non numérique', async () => {
    for (const bad of ['abc', '0', '-1', '1e3', '12abc']) {
      const res = await request(app).get(`/api/v1/works/${bad}`);
      expect(res.status, bad).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('masque une œuvre archivée dans la liste et la fiche, puis la rend une fois restaurée', async () => {
    const id = await idOf('Le Gardien des Sables');
    await client.query('UPDATE work SET deleted_at = now() WHERE id = $1', [id]);
    try {
      expect(await titles('?q=gardien')).toEqual([]);
      expect((await request(app).get('/api/v1/works')).body.total).toBe(9);
      expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(404);
    } finally {
      await client.query('UPDATE work SET deleted_at = NULL WHERE id = $1', [id]);
    }
    expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(200);
  });
});
