import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());

/**
 * Foreign keys to person, publisher and work that may cascade: the record's own child rows (its
 * titles, credits, links…), which go with it. A key from another record that *cites* one of them
 * must refuse the deletion instead.
 */
const OWNED_CHILD_KEYS = [
  'external_link_person_id_fkey',
  'external_link_work_id_fkey',
  'work_credit_work_id_fkey',
  'work_genre_work_id_fkey',
  'work_publisher_work_id_fkey',
  'work_relation_work_id_fkey',
  'work_synopsis_work_id_fkey',
  'work_title_work_id_fkey',
];

describe('clés étrangères vers person, publisher et work', () => {
  it('ne laissent en cascade que les lignes propres à la fiche : une fiche citée refuse sa suppression', async () => {
    const result = await client.query<{ name: string }>(
      `SELECT conname AS name FROM pg_constraint
       WHERE contype = 'f' AND confdeltype NOT IN ('a', 'r')
         AND confrelid IN ('person'::regclass, 'publisher'::regclass, 'work'::regclass)
       ORDER BY conname`,
    );
    expect(result.rows.map((row) => row.name)).toEqual(OWNED_CHILD_KEYS);
  });

  it('refusent de supprimer une personne, un éditeur ou une œuvre cités', async () => {
    const suffix = Date.now();
    const person = await client.query('INSERT INTO person (name) VALUES ($1) RETURNING id', [
      `ZZ refs ${suffix}`,
    ]);
    const work = await client.query(
      `INSERT INTO work (title, type, status, original_language)
       VALUES ($1, 'series', 'ongoing', 'fr') RETURNING id`,
      [`ZZ refs ${suffix}`],
    );
    await client.query("INSERT INTO work_credit VALUES ($1, $2, 'art')", [
      work.rows[0].id,
      person.rows[0].id,
    ]);
    await expect(
      client.query('DELETE FROM person WHERE id = $1', [person.rows[0].id]),
    ).rejects.toMatchObject({ code: '23503' });
    await client.query('DELETE FROM work WHERE id = $1', [work.rows[0].id]);
    await client.query('DELETE FROM person WHERE id = $1', [person.rows[0].id]);
  });
});
