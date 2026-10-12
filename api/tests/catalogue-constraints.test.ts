import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquante (voir .env.example)');
}

const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  await client.query(
    'TRUNCATE external_link, work_genre, genre, work_publisher, publisher, work_credit, person, work_relation, work_title, work RESTART IDENTITY CASCADE',
  );
});

async function work(title = 'Œuvre fictive', extra: Record<string, unknown> = {}): Promise<number> {
  const row = { title, type: 'series', status: 'ongoing', ...extra };
  const keys = Object.keys(row);
  const res = await client.query(
    `INSERT INTO work (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(row),
  );
  return Number(res.rows[0].id);
}

async function person(name = 'Auteur fictif'): Promise<number> {
  const res = await client.query('INSERT INTO person (name) VALUES ($1) RETURNING id', [name]);
  return Number(res.rows[0].id);
}

describe('work', () => {
  it('refuse un type inconnu', async () => {
    await expect(work('X', { type: 'roman' })).rejects.toThrow();
  });

  it('refuse un statut inconnu', async () => {
    await expect(work('X', { status: 'inconnu' })).rejects.toThrow();
  });

  it('refuse des totaux négatifs', async () => {
    await expect(work('X', { chapters: -1 })).rejects.toThrow();
    await expect(work('X', { volumes: -1 })).rejects.toThrow();
  });

  it('refuse une fin antérieure au début', async () => {
    await expect(work('X', { started_on: '2024-05-01', ended_on: '2024-01-01' })).rejects.toThrow();
  });

  it('accepte des totaux vides (œuvre en cours)', async () => {
    await expect(work('X', { chapters: null, volumes: null })).resolves.toBeTypeOf('number');
  });

  it('retrouve un titre sans tenir compte des accents', async () => {
    await work('Éclipse Ardente');
    const res = await client.query(
      "SELECT id FROM work WHERE immutable_unaccent(title) ILIKE immutable_unaccent($1)",
      ['%eclipse%'],
    );
    expect(res.rowCount).toBe(1);
  });
});

describe('work_relation', () => {
  it('refuse une relation d’une œuvre avec elle-même', async () => {
    const a = await work('A');
    await expect(
      client.query("INSERT INTO work_relation VALUES ($1, $1, 'spin_off')", [a]),
    ).rejects.toThrow();
  });

  it('refuse une relation inconnue et un doublon', async () => {
    const a = await work('A');
    const b = await work('B');
    await expect(
      client.query("INSERT INTO work_relation VALUES ($1, $2, 'cousine')", [a, b]),
    ).rejects.toThrow();
    await client.query("INSERT INTO work_relation VALUES ($1, $2, 'spin_off')", [a, b]);
    await expect(
      client.query("INSERT INTO work_relation VALUES ($1, $2, 'spin_off')", [a, b]),
    ).rejects.toThrow();
  });
});

describe('work_credit', () => {
  it('accepte une même personne créditée en scénario et dessin', async () => {
    const w = await work();
    const p = await person();
    await client.query("INSERT INTO work_credit VALUES ($1, $2, 'story')", [w, p]);
    await client.query("INSERT INTO work_credit VALUES ($1, $2, 'art')", [w, p]);
    await expect(
      client.query("INSERT INTO work_credit VALUES ($1, $2, 'art')", [w, p]),
    ).rejects.toThrow();
  });

  it('refuse un rôle inconnu', async () => {
    const w = await work();
    const p = await person();
    await expect(
      client.query("INSERT INTO work_credit VALUES ($1, $2, 'encrage')", [w, p]),
    ).rejects.toThrow();
  });
});

describe('external_link', () => {
  it('exige exactement une cible', async () => {
    const w = await work();
    const p = await person();
    await expect(
      client.query("INSERT INTO external_link (kind, url) VALUES ('website', 'https://exemple.test')"),
    ).rejects.toThrow();
    await expect(
      client.query(
        "INSERT INTO external_link (work_id, person_id, kind, url) VALUES ($1, $2, 'website', 'https://exemple.test')",
        [w, p],
      ),
    ).rejects.toThrow();
    await client.query(
      "INSERT INTO external_link (work_id, kind, url) VALUES ($1, 'read', 'https://exemple.test')",
      [w],
    );
  });

  it('refuse une URL non https', async () => {
    const w = await work();
    await expect(
      client.query("INSERT INTO external_link (work_id, kind, url) VALUES ($1, 'website', 'http://exemple.test')", [w]),
    ).rejects.toThrow();
  });
});

describe('éditeurs et genres', () => {
  it('refuse un type d’éditeur inconnu, un genre en double, un code ou une catégorie invalide', async () => {
    await expect(
      client.query("INSERT INTO publisher (name, kind) VALUES ('X', 'other')"),
    ).rejects.toThrow();
    await client.query("INSERT INTO genre (code, category) VALUES ('manga', 'format')");
    await expect(
      client.query("INSERT INTO genre (code, category) VALUES ('manga', 'format')"),
    ).rejects.toThrow();
    await expect(
      client.query("INSERT INTO genre (code, category) VALUES ('Sci Fi', 'theme')"),
    ).rejects.toThrow();
    await expect(
      client.query("INSERT INTO genre (code, category) VALUES ('fantasy', 'autre')"),
    ).rejects.toThrow();
  });
});
