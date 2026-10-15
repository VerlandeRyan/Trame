import { readFileSync } from 'node:fs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createDb } from '../db/database.js';
import { testDatabaseUrl as connectionString } from '../testing/test-database.js';

const seed = readFileSync(new URL('../../../db/demo-data.sql', import.meta.url), 'utf8');
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
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 11 });
    expect(res.body.items).toHaveLength(11);
  });

  it('pagine et renvoie le total complet', async () => {
    const page2 = await request(app).get('/api/v1/works?page=2&pageSize=3');
    expect(page2.body).toMatchObject({ page: 2, pageSize: 3, total: 11 });
    expect(page2.body.items).toHaveLength(3);
    const page4 = await request(app).get('/api/v1/works?page=4&pageSize=3');
    expect(page4.body.items).toHaveLength(2);
  });

  it('filtre par type, statut, format et genre', async () => {
    expect(await titles('?type=anthology')).toEqual(['Basalte – Le Recueil des Braises']);
    expect(await titles('?status=completed')).toHaveLength(4);
    expect((await titles('?format=bd')).sort()).toEqual([
      'Cap sur les Archipels',
      'Carnet de Colportage',
    ]);
    expect((await titles('?format=webtoon')).sort()).toEqual(['Les Lanternes de Brume']);
    expect((await titles('?genre=fantasy')).sort()).toEqual([
      'Chroniques de Basalte',
      'Les Lanternes de Brume',
    ]);
    // Un format n'est pas un genre thématique, et inversement.
    expect(await titles('?genre=manga')).toEqual([]);
    expect(await titles('?format=fantasy')).toEqual([]);
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

  it('cherche chaque mot séparément : titre, auteur, éditeur, format ou genre', async () => {
    // « webtoon » est un format de la fiche, pas un mot de son titre.
    expect(await titles('?q=lanternes%20webtoon')).toEqual(['Les Lanternes de Brume']);
    expect(await titles('?q=vasseur%20lanternes')).toEqual(['Les Lanternes de Brume']);
    // Un format seul trouve toutes les œuvres de ce format.
    expect(await titles('?q=webtoon')).toEqual(['Les Lanternes de Brume']);
    expect((await titles('?q=bd')).length).toBeGreaterThanOrEqual(2);
    // Les mots dans le désordre donnent le même résultat.
    expect(await titles('?q=webtoon%20lanternes')).toEqual(['Les Lanternes de Brume']);
  });

  it('propose des résultats approchants quand aucun résultat ne contient tous les mots', async () => {
    const exact = await request(app).get('/api/v1/works?q=lanternes%20webtoon');
    expect(exact.body.approximate).toBe(false);

    const approximate = await request(app).get('/api/v1/works?q=lanternes%20bd');
    expect(approximate.body.approximate).toBe(true);
    const found = (approximate.body.items as Item[]).map((item) => item.title);
    expect(found).toContain('Les Lanternes de Brume');
    expect(found).toContain('Carnet de Colportage');

    const none = await request(app).get('/api/v1/works?q=zzzzzz%20yyyyyy');
    expect(none.body).toMatchObject({ total: 0, approximate: false });
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
    expect(Number(res.rows[0].n)).toBe(11);
  });

  it('affiche le titre dans la langue demandée, avec repli sur le titre original', async () => {
    // `Hollow Tide` (originale en) a un titre traduit en fr ; sans `lang` ou en `en`, on garde l'original.
    expect(await titles('?q=hollow')).toEqual(['Hollow Tide']);
    expect(await titles('?q=hollow&lang=en')).toEqual(['Hollow Tide']);
    expect(await titles('?q=hollow&lang=fr')).toEqual(['Marée creuse']);
    // Pas de titre `fr` traduit pour cette œuvre française : le titre original est conservé.
    expect(await titles('?q=lanternes&lang=fr')).toEqual(['Les Lanternes de Brume']);
    // Un titre international en `en` s'affiche pour une œuvre française.
    expect(await titles('?q=lanternes&lang=en')).toEqual(['The Fog Lanterns']);
    // Un titre `short` n'est jamais choisi comme titre affiché.
    expect(await titles('?q=chroniques&lang=fr')).toEqual(['Chroniques de Basalte']);
  });

  it('cherche dans les titres de toutes les langues, quelle que soit `lang`', async () => {
    expect(await titles('?q=maree%20creuse&lang=en')).toEqual(['Hollow Tide']);
  });

  it('retrouve une œuvre par un ancien titre ou un titre court, sans jamais les afficher', async () => {
    expect(await titles('?q=allumeuses')).toEqual(['Les Lanternes de Brume']);
    expect(await titles('?q=cap%20vers%20les%20iles&lang=fr')).toEqual(['Cap sur les Archipels']);
    expect(await titles('?q=archipels&lang=en')).toEqual(['Course for the Archipelagos']);
  });

  it('accepte plusieurs valeurs par filtre (OU), les filtres entre eux se combinent (ET)', async () => {
    expect(await titles('?status=completed,hiatus')).toHaveLength(4);
    expect(await titles('?status=completed,ongoing')).toHaveLength(11);
    expect((await titles('?type=anthology,oneshot')).sort()).toEqual([
      'Basalte – Histoires de Cendre',
      'Basalte – Le Recueil des Braises',
      'Carnet de Colportage',
    ]);
    expect((await titles('?format=bd,webtoon')).sort()).toEqual([
      'Cap sur les Archipels',
      'Carnet de Colportage',
      'Les Lanternes de Brume',
    ]);
    expect((await titles('?type=oneshot,anthology&format=bd,webtoon')).sort()).toEqual([
      'Carnet de Colportage',
    ]);
    expect(await titles('?originalLanguage=en,fr')).toHaveLength(11);
    // Doublons ignorés.
    expect(await titles('?status=completed,completed')).toHaveLength(4);
  });

  it('combine plusieurs genres en ET : chaque genre choisi doit être présent', async () => {
    // « fantasy » seul : deux œuvres ; avec « humor » (porté par la seule Lanternes) : une seule.
    expect((await titles('?genre=fantasy')).sort()).toEqual([
      'Chroniques de Basalte',
      'Les Lanternes de Brume',
    ]);
    expect(await titles('?genre=fantasy,humor')).toEqual(['Les Lanternes de Brume']);
    expect(await titles('?genre=humor,science_fiction')).toEqual([]);
    // Plusieurs formats restent en OU.
    expect((await titles('?format=bd,webtoon')).length).toBeGreaterThanOrEqual(2);
  });

  it('filtre par langue originale', async () => {
    expect(await titles('?originalLanguage=en')).toEqual(['Hollow Tide']);
    expect(await titles('?originalLanguage=ja')).toEqual([]);
    expect(await titles('?originalLanguage=fr')).toHaveLength(10);
  });

  it('expose formats, titre original et langue originale dans la liste', async () => {
    const res = await request(app).get('/api/v1/works?format=webtoon&lang=en');
    expect(res.body.items[0]).toMatchObject({
      title: 'The Fog Lanterns',
      originalTitle: 'Les Lanternes de Brume',
      originalLanguage: 'fr',
      formats: ['manhwa', 'webtoon'],
    });
    const withoutFormat = await request(app).get('/api/v1/works?q=hollow');
    expect(withoutFormat.body.items[0].formats).toEqual([]);
  });

  it('trie par titre ou par date d’ajout, et par pertinence seulement avec une recherche', async () => {
    expect(await titles('?sort=title&pageSize=3')).toEqual([
      'Basalte – Histoires de Cendre',
      'Basalte – Le Recueil des Braises',
      'Cap sur les Archipels',
    ]);

    const id = await idOf('Hollow Tide');
    await client.query("UPDATE work SET created_at = now() + interval '1 day' WHERE id = $1", [id]);
    expect((await titles('?sort=recent'))[0]).toBe('Hollow Tide');
    await client.query('UPDATE work SET created_at = now() WHERE id = $1', [id]);

    // Sans recherche, la pertinence se replie sur le titre ; avec, elle classe d'abord le plus proche.
    expect(await titles('?sort=relevance&pageSize=2')).toEqual(
      await titles('?sort=title&pageSize=2'),
    );
    expect((await titles('?sort=relevance&q=Etoile%20Vagabonde'))[0]).toBe('Étoile Vagabonde');
  });

  it('refuse les paramètres invalides', async () => {
    for (const query of [
      '?type=series,roman',
      '?status=,ongoing',
      '?type=series&type=oneshot',
      `?format=${Array.from({ length: 11 }, (_, index) => `f${index}`).join(',')}`,
      '?sort=note',
      '?sort=',
      '?originalLanguage=FR',
      '?originalLanguage=francais',
      '?lang=de',
      '?lang=FR',
      '?lang=',
      '?q=a',
      '?pageSize=51',
      '?page=0',
      '?type=inconnu',
      '?type=webcomic',
      '?status=lu',
      '?genre=BD',
      '?format=Manga',
      '?q=ab&q=cd',
    ]) {
      const res = await request(app).get(`/api/v1/works${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  describe('GET /api/v1/works/facets', () => {
    async function facets(query = ''): Promise<Record<string, { code: string; count: number }[]>> {
      const res = await request(app).get(`/api/v1/works/facets${query}`);
      expect(res.status).toBe(200);
      return res.body;
    }
    const counts = (group: { code: string; count: number }[]) =>
      Object.fromEntries(group.map(({ code, count }) => [code, count]));

    it('compte les œuvres par type, statut et langue originale', async () => {
      const all = await facets();
      expect(counts(all.type)).toEqual({ series: 8, oneshot: 2, anthology: 1 });
      expect(counts(all.status)).toEqual({ ongoing: 7, completed: 4 });
      expect(counts(all.originalLanguage)).toEqual({ fr: 10, en: 1 });
      expect(counts(all.format)).toMatchObject({ bd: 2, webtoon: 1 });
      expect(counts(all.genre)).toMatchObject({ fantasy: 2 });
      // Tri : nombre décroissant puis code.
      expect(all.type.map((entry) => entry.code)).toEqual(['series', 'oneshot', 'anthology']);
    });

    it('applique la recherche et les autres filtres, mais pas le sien', async () => {
      const filtered = await facets('?type=anthology');
      // Le groupe « type » ignore le filtre de type : les autres choix restent comptés.
      expect(counts(filtered.type)).toEqual({ series: 8, oneshot: 2, anthology: 1 });
      expect(counts(filtered.status)).toEqual({ completed: 1 });
      expect(counts(filtered.originalLanguage)).toEqual({ fr: 1 });

      const searched = await facets('?q=etoile');
      expect(counts(searched.type)).toEqual({ series: 3 });
    });

    it('compte les genres comme un ET : ce que donnerait l’ajout de chaque valeur', async () => {
      const none = await facets();
      expect(counts(none.genre)).toMatchObject({ fantasy: 2, humor: 2, science_fiction: 1 });

      const withFantasy = await facets('?genre=fantasy');
      // Avec « fantasy » choisi : « fantasy » reste à 2, « humor » tombe à 1 (Lanternes seule),
      // « science_fiction » disparaît (aucune œuvre fantasy n'est aussi science-fiction).
      expect(counts(withFantasy.genre)).toEqual({ fantasy: 2, humor: 1 });
    });

    it('suit les résultats approchants avec match=any', async () => {
      const exact = await facets('?q=lanternes%20bd');
      expect(exact.type).toEqual([]);

      const approximate = await facets('?q=lanternes%20bd&match=any');
      expect(approximate.type.length).toBeGreaterThan(0);

      const invalid = await request(app).get('/api/v1/works/facets?match=tous');
      expect(invalid.status).toBe(400);
    });

    it('ne dépend pas du tri', async () => {
      expect(await facets('?sort=recent')).toEqual(await facets());
    });

    it('ignore les œuvres archivées et refuse les paramètres invalides', async () => {
      const id = await idOf('Hollow Tide');
      await client.query('UPDATE work SET deleted_at = now() WHERE id = $1', [id]);
      expect(counts((await facets()).originalLanguage)).toEqual({ fr: 10 });
      await client.query('UPDATE work SET deleted_at = NULL WHERE id = $1', [id]);

      for (const query of ['?q=a', '?type=inconnu', '?originalLanguage=FR']) {
        const res = await request(app).get(`/api/v1/works/facets${query}`);
        expect(res.status, query).toBe(400);
      }
    });
  });

  it('n’expose la couverture qu’avec l’accord enregistré', async () => {
    const id = await idOf('Carnet de Colportage');
    await client.query(
      "UPDATE work SET cover_path = 'covers/test.webp', cover_consent = false WHERE id = $1",
      [id],
    );
    const without = await request(app).get('/api/v1/works?q=colportage');
    expect(without.body.items[0].coverPath).toBeNull();
    await client.query('UPDATE work SET cover_consent = true WHERE id = $1', [id]);
    const withConsent = await request(app).get('/api/v1/works?q=colportage');
    expect(withConsent.body.items[0].coverPath).toBe('covers/test.webp');
    const detail = await request(app).get(`/api/v1/works/${id}`);
    expect(detail.body.coverPath).toBe('covers/test.webp');
    await client.query('UPDATE work SET cover_path = NULL, cover_consent = false WHERE id = $1', [
      id,
    ]);
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
      originalTitle: 'Chroniques de Basalte',
      originalLanguage: 'fr',
      alternativeTitles: [{ language: 'fr', kind: 'short', title: 'Basalte' }],
      synopsis: 'Un cartographe suit une faille qui dévore les routes.',
      synopsisLanguage: 'fr',
      synopsisSource: 'official',
      formats: ['manga'],
      genres: ['fantasy'],
    });
    expect(res.body.credits).toEqual([
      {
        personId: expect.any(Number),
        name: 'Théo Marchand',
        kind: 'person',
        roles: ['story', 'art'],
        links: [
          {
            kind: 'social',
            url: 'https://reseau.exemple.test/theo-marchand',
            label: "Profil de l'auteur",
          },
        ],
      },
    ]);
    expect(res.body.publishers).toEqual([
      {
        id: expect.any(Number),
        name: 'Éditions Marais Bleu (fictives)',
        kind: 'publisher',
        url: expect.stringContaining('https://'),
      },
    ]);
    // Relations stockées dans un seul sens : ici, uniquement des relations entrantes.
    expect(res.body.relations).toHaveLength(2);
    for (const r of res.body.relations) expect(r.direction).toBe('incoming');
    expect(res.body.relations.map((r: { relation: string }) => r.relation).sort()).toEqual([
      'shared_universe',
      'spin_off',
    ]);
  });

  it('renvoie les totaux, les liens et les relations sortantes', async () => {
    const lanternes = await request(app).get(
      `/api/v1/works/${await idOf('Les Lanternes de Brume')}`,
    );
    expect(lanternes.body).toMatchObject({ chapters: 120, volumes: 3, endedOn: '2023-06-30' });
    expect(lanternes.body.links.map((l: { kind: string }) => l.kind)).toEqual(['buy', 'read']);

    const recueil = await request(app).get(
      `/api/v1/works/${await idOf('Basalte – Le Recueil des Braises')}`,
    );
    const outgoing = recueil.body.relations.filter(
      (r: { direction: string }) => r.direction === 'outgoing',
    );
    expect(outgoing.map((r: { relation: string }) => r.relation).sort()).toEqual([
      'contains',
      'shared_universe',
    ]);
  });

  it('compte les membres et les notes, sans moyenne sous 10 notes', async () => {
    const basalte = await request(app).get(`/api/v1/works/${await idOf('Chroniques de Basalte')}`);
    expect(basalte.body).toMatchObject({ memberCount: 2, ratingCount: 1, ratingAverage: null });
    expect(basalte.body).not.toHaveProperty('ratingSum');

    const sansMembre = await request(app).get(
      `/api/v1/works/${await idOf('Le Gardien des Sables')}`,
    );
    expect(sansMembre.body).toMatchObject({ memberCount: 0, ratingCount: 0, ratingAverage: null });
  });

  it('publie la moyenne dès 10 notes, profils privés inclus, arrondie à une décimale', async () => {
    const id = await idOf('Les Lanternes de Brume');
    // Une note de 8 existe déjà ; 9 lecteurs au profil privé notent 6 → moyenne 62 / 10 = 6,2.
    await client.query(
      `INSERT INTO app_user (email, google_sub, handle, profile_visibility)
       SELECT 'prive' || n || '@exemple.test', 'sub-prive-' || n, 'prive' || n, 'private'
       FROM generate_series(1, 9) AS n`,
    );
    await client.query(
      `INSERT INTO library_entry (user_id, work_id, status, rating)
       SELECT u.id, $1, 'reading', 6 FROM app_user u WHERE u.handle LIKE 'prive%'`,
      [id],
    );
    try {
      const res = await request(app).get(`/api/v1/works/${id}`);
      expect(res.body).toMatchObject({ memberCount: 10, ratingCount: 10, ratingAverage: 6.2 });
    } finally {
      await client.query(
        "DELETE FROM library_entry WHERE user_id IN (SELECT id FROM app_user WHERE handle LIKE 'prive%')",
      );
      await client.query("DELETE FROM app_user WHERE handle LIKE 'prive%'");
    }
  });

  it('renvoie le synopsis dans la langue demandée, sinon dans la langue originale', async () => {
    const lanternes = await idOf('Les Lanternes de Brume');
    const en = await request(app).get(`/api/v1/works/${lanternes}?lang=en`);
    expect(en.body).toMatchObject({
      title: 'The Fog Lanterns',
      originalTitle: 'Les Lanternes de Brume',
      synopsis: 'An apprentice lamplighter discovers what lives in the fog.',
      synopsisLanguage: 'en',
      synopsisSource: 'human',
    });
    // Sans `lang` : langue originale.
    const none = await request(app).get(`/api/v1/works/${lanternes}`);
    expect(none.body).toMatchObject({
      title: 'Les Lanternes de Brume',
      synopsisLanguage: 'fr',
      synopsisSource: 'official',
    });

    // Œuvre anglophone : synopsis `fr` automatique, repli sur l'original en l'absence de `lang`.
    const tide = await idOf('Hollow Tide');
    const fr = await request(app).get(`/api/v1/works/${tide}?lang=fr`);
    expect(fr.body).toMatchObject({
      title: 'Marée creuse',
      originalLanguage: 'en',
      synopsisLanguage: 'fr',
      synopsisSource: 'machine',
    });
    const original = await request(app).get(`/api/v1/works/${tide}`);
    expect(original.body).toMatchObject({
      title: 'Hollow Tide',
      synopsisLanguage: 'en',
      synopsisSource: 'official',
    });
  });

  it('replie le synopsis sur la langue originale et accepte une œuvre sans synopsis', async () => {
    const id = await idOf('Cap sur les Archipels');
    const en = await request(app).get(`/api/v1/works/${id}?lang=en`);
    expect(en.body).toMatchObject({ synopsisLanguage: 'fr', synopsisSource: 'official' });
    await client.query('DELETE FROM work_synopsis WHERE work_id = $1', [id]);
    try {
      const res = await request(app).get(`/api/v1/works/${id}?lang=en`);
      expect(res.body).toMatchObject({
        synopsis: null,
        synopsisLanguage: null,
        synopsisSource: null,
      });
    } finally {
      await client.query(
        "INSERT INTO work_synopsis VALUES ($1, 'fr', 'Un équipage de fortune et ses îles qui changent de place.', 'official')",
        [id],
      );
    }
  });

  it('refuse une langue inconnue sur la fiche', async () => {
    const res = await request(app).get(`/api/v1/works/${await idOf('Hollow Tide')}?lang=de`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('localise le titre des œuvres liées', async () => {
    const [a, b] = [await idOf('Hollow Tide'), await idOf('Le Gardien des Sables')];
    await client.query("INSERT INTO work_relation VALUES ($1, $2, 'shared_universe')", [b, a]);
    try {
      const fr = await request(app).get(`/api/v1/works/${b}?lang=fr`);
      expect(fr.body.relations[0].work).toMatchObject({ id: a, title: 'Marée creuse' });
      const none = await request(app).get(`/api/v1/works/${b}`);
      expect(none.body.relations[0].work).toMatchObject({ id: a, title: 'Hollow Tide' });
    } finally {
      await client.query('DELETE FROM work_relation WHERE work_id = $1 AND related_work_id = $2', [
        b,
        a,
      ]);
    }
  });

  it('trie les personnes crédités par rôle le plus important, puis par nom', async () => {
    const res = await request(app).get(
      `/api/v1/works/${await idOf('Basalte – Histoires de Cendre')}`,
    );
    // Par nom seul, Léa Fontaine passerait avant Théo Marchand : l'ordre vient du rôle.
    expect(
      res.body.credits.map((c: { name: string; roles: string[] }) => [c.name, c.roles]),
    ).toEqual([
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
      expect((await request(app).get('/api/v1/works')).body.total).toBe(10);
      expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(404);
    } finally {
      await client.query('UPDATE work SET deleted_at = NULL WHERE id = $1', [id]);
    }
    expect((await request(app).get(`/api/v1/works/${id}`)).status).toBe(200);
  });
});
