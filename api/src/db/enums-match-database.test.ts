import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as catalogue from '../domain/catalogue-enums.js';
import * as user from '../domain/user-enums.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());

// Colonne de la base → énumération du code : les deux doivent contenir exactement les mêmes valeurs.
const ENUM_COLUMNS: [table: string, column: string, values: readonly string[]][] = [
  ['work', 'type', catalogue.WORK_TYPES],
  ['work', 'status', catalogue.WORK_STATUSES],
  ['work_title', 'kind', catalogue.TITLE_KINDS],
  ['work_synopsis', 'source', catalogue.SYNOPSIS_SOURCES],
  ['work_relation', 'relation', catalogue.RELATION_KINDS],
  ['person', 'kind', catalogue.PERSON_KINDS],
  ['work_credit', 'role', catalogue.CREDIT_ROLES],
  ['publisher', 'kind', catalogue.PUBLISHER_KINDS],
  ['genre', 'category', catalogue.GENRE_CATEGORIES],
  ['external_link', 'kind', catalogue.EXTERNAL_LINK_KINDS],
  ['library_entry', 'status', user.LIBRARY_STATUSES],
  ['reading_event', 'kind', user.READING_EVENT_KINDS],
  ['reading_event', 'new_status', user.LIBRARY_STATUSES],
  ['app_user', 'role', user.USER_ROLES],
  ['app_user', 'profile_visibility', user.PROFILE_VISIBILITIES],
];

async function allowedValues(table: string, column: string): Promise<string[]> {
  const { rows } = await client.query<{ definition: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = $2
      WHERE t.relname = $1 AND c.contype = 'c' AND c.conkey = ARRAY[a.attnum]`,
    [table, column],
  );
  return rows.flatMap((row) => [...row.definition.matchAll(/'([^']+)'::text/g)].map((m) => m[1]!));
}

const sorted = (values: readonly string[]) => [...values].sort((a, b) => a.localeCompare(b));

describe('énumérations du code ↔ contraintes CHECK de la base', () => {
  it.each(ENUM_COLUMNS)('%s.%s', async (table, column, values) => {
    expect(sorted(await allowedValues(table, column))).toEqual(sorted(values));
  });
});
