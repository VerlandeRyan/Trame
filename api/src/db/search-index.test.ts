import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const client = new pg.Client({ connectionString });

beforeAll(async () => {
  await client.connect();
  // Les tables de test sont presque vides : sans cela le planificateur préfère un balayage séquentiel.
  // On vérifie ici que l'index est *utilisable* par l'expression exacte du dépôt, pas qu'il est choisi.
  await client.query('SET enable_seqscan = off');
});
afterAll(() => client.end());

async function plan(sql: string): Promise<string> {
  const res = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN ${sql}`);
  return res.rows.map((row) => row['QUERY PLAN']).join('\n');
}

const INDEXED_COLUMNS = [
  { table: 'work', column: 'title', index: 'work_title_trgm_idx' },
  { table: 'work_title', column: 'title', index: 'work_title_title_trgm_idx' },
  { table: 'person', column: 'name', index: 'person_name_trgm_idx' },
  { table: 'publisher', column: 'name', index: 'publisher_name_trgm_idx' },
];

describe.each(INDEXED_COLUMNS)('index de recherche $index', ({ table, column, index }) => {
  it('sert la comparaison ILIKE insensible aux accents', async () => {
    const result = await plan(
      `SELECT 1 FROM ${table} WHERE immutable_unaccent(${column}) ILIKE immutable_unaccent('%eclipse%')`,
    );
    expect(result).toContain(index);
  });

  it('sert la tolérance aux fautes (<%)', async () => {
    const result = await plan(
      `SELECT 1 FROM ${table} WHERE immutable_unaccent('eclispe') <% immutable_unaccent(${column})`,
    );
    expect(result).toContain(index);
  });
});
