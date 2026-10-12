import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquante (voir .env.example)');
}

const seed = readFileSync(new URL('../../db/demo-data.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString });

async function count(sql: string): Promise<number> {
  const res = await client.query(sql);
  return Number(res.rows[0].n);
}

beforeAll(async () => {
  await client.connect();
  await client.query(seed);
});
afterAll(() => client.end());

describe('jeu de démonstration', () => {
  it('est rejouable sans doublon', async () => {
    const before = await count('SELECT count(*) AS n FROM work');
    await client.query(seed);
    expect(await count('SELECT count(*) AS n FROM work')).toBe(before);
    expect(before).toBe(11);
  });

  it('couvre une langue originale non française et des synopsis de plusieurs sources', async () => {
    expect(await count("SELECT count(*) AS n FROM work WHERE original_language <> 'fr'")).toBeGreaterThan(0);
    expect(await count('SELECT count(DISTINCT source) AS n FROM work_synopsis')).toBe(3);
    expect(await count("SELECT count(*) AS n FROM work_title WHERE language <> 'fr'")).toBeGreaterThan(0);
  });

  it('a un synopsis dans la langue originale de chaque œuvre', async () => {
    expect(
      await count(
        'SELECT count(*) AS n FROM work w WHERE NOT EXISTS (SELECT 1 FROM work_synopsis s WHERE s.work_id = w.id AND s.language = w.original_language)',
      ),
    ).toBe(0);
  });

  it('ne contient que des adresses e-mail fictives', async () => {
    expect(await count("SELECT count(*) AS n FROM app_user WHERE email NOT LIKE '%@exemple.test'")).toBe(0);
    expect(await count('SELECT count(*) AS n FROM app_user')).toBeGreaterThan(0);
  });

  it('ne contient que des liens sur des domaines fictifs', async () => {
    expect(await count("SELECT count(*) AS n FROM external_link WHERE url NOT LIKE 'https://%.exemple.test%'")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM publisher WHERE url IS NOT NULL AND url NOT LIKE 'https://%.exemple.test%'")).toBe(0);
  });

  it('laisse les totaux vides pour les œuvres en cours et les renseigne pour les terminées', async () => {
    expect(
      await count("SELECT count(*) AS n FROM work WHERE status = 'ongoing' AND (chapters IS NOT NULL OR volumes IS NOT NULL)"),
    ).toBe(0);
    expect(await count("SELECT count(*) AS n FROM work WHERE type = 'series' AND status = 'completed' AND chapters IS NOT NULL AND volumes IS NOT NULL")).toBe(1);
  });

  it('couvre une personne créditée deux fois sur la même œuvre', async () => {
    expect(
      await count('SELECT count(*) AS n FROM (SELECT 1 FROM work_credit GROUP BY work_id, person_id HAVING count(*) = 2) t'),
    ).toBeGreaterThan(0);
  });

  it('couvre un éditeur partagé et une œuvre avec plateforme et éditeur', async () => {
    expect(
      await count('SELECT count(*) AS n FROM (SELECT 1 FROM work_publisher GROUP BY publisher_id HAVING count(*) >= 3) t'),
    ).toBeGreaterThan(0);
    expect(
      await count('SELECT count(*) AS n FROM (SELECT 1 FROM work_publisher GROUP BY work_id HAVING count(*) = 2) t'),
    ).toBeGreaterThan(0);
  });

  it('couvre spin_off (deux sur une même série), contains et shared_universe', async () => {
    expect(
      await count("SELECT count(*) AS n FROM (SELECT 1 FROM work_relation WHERE relation = 'spin_off' GROUP BY related_work_id HAVING count(*) = 2) t"),
    ).toBeGreaterThan(0);
    expect(await count("SELECT count(*) AS n FROM work_relation WHERE relation IN ('contains', 'shared_universe')")).toBe(2);
  });

  it('garde chapitres lus et tomes lus indépendants', async () => {
    expect(await count('SELECT count(*) AS n FROM library_entry WHERE chapters_read > 0 AND volumes_read = 0')).toBeGreaterThan(0);
    expect(await count('SELECT count(*) AS n FROM library_entry WHERE chapters_read = 0 AND volumes_read > 0')).toBeGreaterThan(0);
  });

  it('couvre les quatre types d’événements de lecture', async () => {
    expect(await count('SELECT count(DISTINCT kind) AS n FROM reading_event')).toBe(4);
  });

  it('contient une soumission en attente et aucune œuvre archivée', async () => {
    expect(await count("SELECT count(*) AS n FROM submission WHERE status = 'pending'")).toBe(1);
    expect(await count('SELECT count(*) AS n FROM work WHERE deleted_at IS NOT NULL')).toBe(0);
  });
});
