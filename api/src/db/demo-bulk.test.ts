import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const bulk = readFileSync(new URL('../../../db/demo-bulk.sql', import.meta.url), 'utf8');
const remove = readFileSync(new URL('../../../db/demo-bulk-remove.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());
// Chaque test tourne dans une transaction annulée : la base de test reste intacte.
beforeEach(async () => {
  await client.query('ROLLBACK');
  await client.query('BEGIN');
});

async function count(table: string, where = 'true'): Promise<number> {
  const res = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`);
  return res.rows[0].n as number;
}

describe('jeu de démonstration en volume', () => {
  it('ajoute assez d’œuvres pour paginer et assez de genres pour « Voir les N autres »', async () => {
    await client.query(bulk);

    expect(await count('work', "title LIKE '[Démo] %'")).toBe(48);
    expect(await count('genre', "category = 'theme'")).toBeGreaterThanOrEqual(6);
    const withoutGenre = await client.query(
      "SELECT count(*)::int AS n FROM work w WHERE w.title LIKE '[Démo] %' AND (SELECT count(*) FROM work_genre g WHERE g.work_id = w.id) < 2",
    );
    expect(withoutGenre.rows[0].n).toBe(0);
  });

  it('relie des œuvres entre elles pour essayer les groupes de la fiche', async () => {
    await client.query(bulk);

    const relations = await client.query(
      `SELECT relation, count(*)::int AS n FROM work_relation r
         JOIN work w ON w.id = r.work_id WHERE w.title LIKE '[Démo] %'
        GROUP BY relation ORDER BY relation`,
    );
    const byKind = Object.fromEntries(relations.rows.map((row) => [row.relation, row.n]));

    expect(byKind).toMatchObject({ sequel: 2, spin_off: 2, contains: 2, shared_universe: 1 });
    expect(Object.keys(byKind)).toEqual(
      expect.arrayContaining(['alternate_version', 'side_story', 'adaptation']),
    );
  });

  it('est rejouable : un second chargement ne double pas les œuvres', async () => {
    await client.query(bulk);
    await client.query(bulk);

    expect(await count('work', "title LIKE '[Démo] %'")).toBe(48);
    expect(await count('person', "name LIKE '% (démo)'")).toBe(12);
  });

  it('donne assez d’activité pour remplir « À la une » et « Mieux notées » de l’accueil', async () => {
    await client.query(bulk);

    const rated = await client.query(
      `SELECT count(*)::int AS n FROM (
         SELECT work_id FROM library_entry GROUP BY work_id HAVING count(rating) >= 10
       ) t WHERE work_id IN (SELECT id FROM work WHERE title LIKE '[Démo] %')`,
    );
    const popular = await client.query(
      `SELECT count(*)::int AS n FROM (
         SELECT work_id FROM library_entry
          WHERE created_at >= now() - interval '7 days'
          GROUP BY work_id HAVING count(*) >= 3
       ) t WHERE work_id IN (SELECT id FROM work WHERE title LIKE '[Démo] %')`,
    );

    // 12 œuvres notées au moins : une rangée « Mieux notées » pleine sur grand écran.
    expect(rated.rows[0].n).toBeGreaterThanOrEqual(12);
    expect(popular.rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it('retire aussi les lecteurs fictifs et leurs entrées', async () => {
    const entriesBefore = await count('library_entry');
    await client.query(bulk);
    expect(await count('library_entry')).toBeGreaterThan(entriesBefore);

    await client.query(remove);

    expect(await count('app_user', "email LIKE 'demo.%@exemple.test'")).toBe(0);
    expect(await count('library_entry')).toBe(entriesBefore);
  });

  it('ne retire que les lignes marquées', async () => {
    await client.query(
      "INSERT INTO work (title, type, status, original_language) VALUES ('Œuvre fictive', 'series', 'ongoing', 'fr')",
    );
    await client.query(bulk);

    await client.query(remove);

    expect(await count('work', "title LIKE '[Démo] %'")).toBe(0);
    expect(await count('person', "name LIKE '% (démo)'")).toBe(0);
    expect(await count('work', "title = 'Œuvre fictive'")).toBe(1);
  });
});
