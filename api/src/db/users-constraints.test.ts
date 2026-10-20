import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const client = new pg.Client({ connectionString });

beforeAll(() => client.connect());
afterAll(() => client.end());
beforeEach(async () => {
  // CASCADE vide aussi work (clé étrangère deleted_by) : base de test uniquement.
  await client.query(
    'TRUNCATE submission, reading_event, library_entry, app_user, work RESTART IDENTITY CASCADE',
  );
});

let seq = 0;
async function user(extra: Record<string, unknown> = {}): Promise<number> {
  seq += 1;
  const row = {
    email: `lecteur${seq}@exemple.test`,
    google_sub: `sub-${seq}`,
    handle: `lecteur${seq}`,
    ...extra,
  };
  const keys = Object.keys(row);
  const res = await client.query(
    `INSERT INTO app_user (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(row),
  );
  return Number(res.rows[0].id);
}

async function work(): Promise<number> {
  const res = await client.query(
    "INSERT INTO work (title, type, status, original_language) VALUES ('Œuvre fictive', 'series', 'ongoing', 'fr') RETURNING id",
  );
  return Number(res.rows[0].id);
}

describe('app_user', () => {
  it('applique les valeurs par défaut (role user, profil public)', async () => {
    const id = await user();
    const res = await client.query('SELECT role, profile_visibility FROM app_user WHERE id = $1', [
      id,
    ]);
    expect(res.rows[0]).toEqual({ role: 'user', profile_visibility: 'public' });
  });

  it('refuse un rôle ou une visibilité inconnus', async () => {
    await expect(user({ role: 'superadmin' })).rejects.toThrow();
    await expect(user({ profile_visibility: 'amis' })).rejects.toThrow();
  });

  it('refuse un handle mal formé ou réservé', async () => {
    await expect(user({ handle: 'ab' })).rejects.toThrow();
    await expect(user({ handle: 'Mot Passe' })).rejects.toThrow();
    await expect(user({ handle: 'a'.repeat(31) })).rejects.toThrow();
    await expect(user({ handle: 'admin' })).rejects.toThrow();
    await expect(user({ handle: 'ADMIN' })).rejects.toThrow();
    await expect(user({ handle: 'Admin' })).rejects.toThrow();
  });

  it('conserve la casse du handle saisi', async () => {
    const id = await user({ handle: 'Ryan_B' });
    const res = await client.query('SELECT handle FROM app_user WHERE id = $1', [id]);
    expect(res.rows[0].handle).toBe('Ryan_B');
  });

  it('refuse un handle, un e-mail ou un compte Google en double (sans tenir compte de la casse)', async () => {
    await user({ handle: 'lecteur', email: 'a@exemple.test', google_sub: 'g1' });
    await expect(user({ handle: 'LECTEUR' })).rejects.toThrow();
    await expect(user({ email: 'A@EXEMPLE.TEST' })).rejects.toThrow();
    await expect(user({ google_sub: 'g1' })).rejects.toThrow();
  });
});

describe('work.deleted_by', () => {
  it('doit référencer un utilisateur existant', async () => {
    await expect(
      client.query(
        "INSERT INTO work (title, type, status, original_language, deleted_by) VALUES ('X', 'series', 'ongoing', 'fr', 999999)",
      ),
    ).rejects.toThrow();
    const admin = await user({ role: 'admin' });
    await client.query(
      "INSERT INTO work (title, type, status, original_language, deleted_at, deleted_by) VALUES ('X', 'series', 'ongoing', 'fr', now(), $1)",
      [admin],
    );
  });
});

describe('library_entry', () => {
  it('refuse un second suivi de la même œuvre par le même utilisateur', async () => {
    const u = await user();
    const w = await work();
    await client.query(
      "INSERT INTO library_entry (user_id, work_id, status) VALUES ($1, $2, 'reading')",
      [u, w],
    );
    await expect(
      client.query(
        "INSERT INTO library_entry (user_id, work_id, status) VALUES ($1, $2, 'completed')",
        [u, w],
      ),
    ).rejects.toThrow();
  });

  it('refuse statut inconnu, compteurs négatifs et note hors 1-10', async () => {
    const u = await user();
    const w = await work();
    const insert = (status: string, chapters: number, volumes: number, rating: number | null) =>
      client.query(
        'INSERT INTO library_entry (user_id, work_id, status, chapters_read, volumes_read, rating) VALUES ($1, $2, $3, $4, $5, $6)',
        [u, w, status, chapters, volumes, rating],
      );
    await expect(insert('lu', 0, 0, null)).rejects.toThrow();
    await expect(insert('reading', -1, 0, null)).rejects.toThrow();
    await expect(insert('reading', 0, -1, null)).rejects.toThrow();
    await expect(insert('reading', 0, 0, 0)).rejects.toThrow();
    await expect(insert('reading', 0, 0, 11)).rejects.toThrow();
  });

  it('accepte des chapitres lus et des tomes lus indépendants', async () => {
    const u = await user();
    const w = await work();
    const result = await client.query(
      "INSERT INTO library_entry (user_id, work_id, status, chapters_read, volumes_read) VALUES ($1, $2, 'reading', 100, 2)",
      [u, w],
    );
    expect(result.rowCount).toBe(1);
  });
});

describe('reading_event', () => {
  const insert = (u: number, w: number, kind: string, cols: Record<string, unknown>) => {
    const row = { user_id: u, work_id: w, kind, ...cols };
    const keys = Object.keys(row);
    return client.query(
      `INSERT INTO reading_event (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row),
    );
  };

  it('accepte un événement par type avec la bonne colonne', async () => {
    const u = await user();
    const w = await work();
    const results = [
      await insert(u, w, 'chapters', { chapters_added: 5 }),
      await insert(u, w, 'volumes', { volumes_added: 1 }),
      await insert(u, w, 'status', { new_status: 'completed' }),
      await insert(u, w, 'rating', { new_rating: 8 }),
    ];
    expect(results.map((r) => r.rowCount)).toEqual([1, 1, 1, 1]);
  });

  it('refuse la mauvaise colonne, plusieurs colonnes ou aucune', async () => {
    const u = await user();
    const w = await work();
    await expect(insert(u, w, 'chapters', { volumes_added: 1 })).rejects.toThrow();
    await expect(insert(u, w, 'chapters', { chapters_added: 5, new_rating: 8 })).rejects.toThrow();
    await expect(insert(u, w, 'rating', {})).rejects.toThrow();
    await expect(insert(u, w, 'inconnu', { chapters_added: 1 })).rejects.toThrow();
  });

  it('refuse une note ou un statut invalides', async () => {
    const u = await user();
    const w = await work();
    await expect(insert(u, w, 'rating', { new_rating: 11 })).rejects.toThrow();
    await expect(insert(u, w, 'status', { new_status: 'lu' })).rejects.toThrow();
  });
});

describe('submission', () => {
  it('démarre en attente et exige un statut connu', async () => {
    const u = await user();
    const res = await client.query(
      'INSERT INTO submission (payload, submitted_by) VALUES (\'{"title": "Titre proposé"}\', $1) RETURNING status',
      [u],
    );
    expect(res.rows[0].status).toBe('pending');
    await expect(
      client.query(
        "INSERT INTO submission (payload, status, submitted_by) VALUES ('{}', 'perdue', $1)",
        [u],
      ),
    ).rejects.toThrow();
  });

  it('exige une charge utile et un auteur existant', async () => {
    await expect(
      client.query('INSERT INTO submission (payload, submitted_by) VALUES (NULL, 1)'),
    ).rejects.toThrow();
    await expect(
      client.query("INSERT INTO submission (payload, submitted_by) VALUES ('{}', 999999)"),
    ).rejects.toThrow();
  });
});
