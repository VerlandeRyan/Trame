-- Jeu de démonstration en volume (fictif) : 48 œuvres pour essayer pagination, genres et tri.
--
-- Ne vide rien : ajoute des lignes marquées « [Démo] » (œuvres) et « (démo) » (personnes,
-- éditeurs) après avoir retiré celles d'un chargement précédent ; rejouable.
-- Chargement : `npm run db:seed:bulk` (api/). Retrait : db/demo-bulk-remove.sql.

-- Nettoyage d'un chargement précédent ------------------------------------------
DELETE FROM library_entry
 WHERE work_id IN (SELECT id FROM work WHERE title LIKE '[Démo] %')
    OR user_id IN (SELECT id FROM app_user WHERE email LIKE 'demo.%@exemple.test');
DELETE FROM app_user WHERE email LIKE 'demo.%@exemple.test';
DELETE FROM work WHERE title LIKE '[Démo] %';
DELETE FROM person WHERE name LIKE '% (démo)';
DELETE FROM publisher WHERE name LIKE '% (démo)';

-- Genres : on ajoute ceux qui manquent, sans toucher aux existants ------------
INSERT INTO genre (code, category)
SELECT v.code, v.category
FROM (VALUES
  ('manga', 'format'), ('manhwa', 'format'), ('bd', 'format'), ('webtoon', 'format'), ('webcomic', 'format'),
  ('fantasy', 'theme'), ('humor', 'theme'), ('science_fiction', 'theme'), ('adventure', 'theme'),
  ('drama', 'theme'), ('romance', 'theme'), ('thriller', 'theme'), ('slice_of_life', 'theme')
) AS v(code, category)
WHERE NOT EXISTS (SELECT 1 FROM genre g WHERE g.code = v.code);

-- Personnes et éditeurs --------------------------------------------------------
INSERT INTO person (name, kind)
SELECT 'Auteur Démo ' || n || ' (démo)', 'person' FROM generate_series(1, 12) AS n;

INSERT INTO publisher (name, kind, url) VALUES
  ('Éditions Démo (démo)',  'publisher',      NULL),
  ('Plateforme Démo (démo)', 'platform',      NULL),
  ('Atelier Démo (démo)',   'self_published', NULL);

-- Œuvres : types, statuts, langues et dates d'ajout variés ----------------------
INSERT INTO work (title, type, status, original_language, created_at)
SELECT
  '[Démo] '
    || (ARRAY['Aube', 'Brume', 'Cendre', 'Dune', 'Écume', 'Falaise', 'Givre', 'Havre'])[1 + (n % 8)]
    || ' '
    || (ARRAY['Rouge', 'Pâle', 'Lointaine', 'Secrète', 'Fragile', 'Muette'])[1 + (n % 6)]
    || ' ' || n,
  (ARRAY['series', 'series', 'oneshot', 'anthology'])[1 + (n % 4)],
  (ARRAY['ongoing', 'completed', 'hiatus', 'upcoming', 'abandoned'])[1 + (n % 5)],
  (ARRAY['fr', 'fr', 'en', 'ja'])[1 + (n % 4)],
  now() - (n || ' hours')::interval
FROM generate_series(1, 48) AS n;

-- Synopsis en français pour chaque œuvre (affichés dans « À la une »), de quatre longueurs de phrase.
INSERT INTO work_synopsis (work_id, language, text, source)
SELECT w.id, 'fr',
  (ARRAY[
    'Une anthologie de récits courts où chaque auteur imagine un désert différent.',
    'Un one-shot sur un braquage qui tourne à la fable, dessiné à l''encre sur papier ocre.',
    'Une série où un village disparaît chaque nuit dans la brume, un habitant à la fois.',
    'Une cartographe suit une côte qui change de forme à chaque marée et découvre qui la redessine.'
  ])[1 + (substring(w.title FROM '(\d+)$')::int % 4)],
  'official'
FROM work w WHERE w.title LIKE '[Démo] %';

-- Format et un à deux genres par œuvre, répartis de façon inégale (compteurs, « Voir les N autres »).
WITH demo AS (
  SELECT id, substring(title FROM '(\d+)$')::int AS n FROM work WHERE title LIKE '[Démo] %'
),
themes AS (
  SELECT ARRAY[
    'fantasy', 'fantasy', 'fantasy', 'fantasy', 'fantasy',
    'adventure', 'adventure', 'adventure', 'adventure',
    'humor', 'humor', 'humor',
    'drama', 'drama', 'drama',
    'romance', 'romance',
    'science_fiction', 'thriller', 'slice_of_life'
  ] AS list
)
INSERT INTO work_genre (work_id, genre_id)
SELECT d.id, g.id FROM demo d
  JOIN genre g ON g.code = (ARRAY['manga', 'manhwa', 'bd', 'webtoon', 'webcomic'])[1 + d.n % 5]
UNION
SELECT d.id, g.id FROM demo d CROSS JOIN themes t
  JOIN genre g ON g.code = t.list[1 + (d.n * 7) % 20]
UNION
SELECT d.id, g.id FROM demo d CROSS JOIN themes t
  JOIN genre g ON g.code = t.list[1 + (d.n * 11 + 3) % 20];

-- Crédits : un auteur par œuvre (scénario), le dessin pour les numéros pairs ---------
WITH demo AS (
  SELECT id, substring(title FROM '(\d+)$')::int AS n FROM work WHERE title LIKE '[Démo] %'
)
INSERT INTO work_credit (work_id, person_id, role)
SELECT d.id, p.id, 'story' FROM demo d
  JOIN person p ON p.name = 'Auteur Démo ' || (1 + d.n % 12) || ' (démo)'
UNION
SELECT d.id, p.id, 'art' FROM demo d
  JOIN person p ON p.name = 'Auteur Démo ' || (1 + (d.n + 5) % 12) || ' (démo)'
WHERE d.n % 2 = 0;

-- Relations : de quoi voir les groupes d'œuvres liées sur une fiche -----------------
-- Fiches à ouvrir : « [Démo] Brume Pâle 1 » (tous les groupes) et « [Démo] Havre Pâle 7 » (recueil).
WITH demo AS (
  SELECT id, substring(title FROM '(\d+)$')::int AS n FROM work WHERE title LIKE '[Démo] %'
)
INSERT INTO work_relation (work_id, related_work_id, relation)
SELECT a.id, b.id, r.relation
FROM (VALUES
  (2, 1, 'sequel'),
  (3, 2, 'sequel'),
  (4, 1, 'spin_off'),
  (5, 1, 'spin_off'),
  (7, 4, 'contains'),
  (7, 5, 'contains'),
  (7, 1, 'shared_universe'),
  (12, 1, 'alternate_version'),
  (14, 13, 'side_story'),
  (16, 15, 'adaptation')
) AS r(work_n, related_n, relation)
  JOIN demo a ON a.n = r.work_n
  JOIN demo b ON b.n = r.related_n;

-- Éditeurs : trois œuvres sur quatre ont un éditeur ou une plateforme ----------------
WITH demo AS (
  SELECT id, substring(title FROM '(\d+)$')::int AS n FROM work WHERE title LIKE '[Démo] %'
)
INSERT INTO work_publisher (work_id, publisher_id)
SELECT d.id, p.id FROM demo d
  JOIN publisher p ON p.name = (ARRAY['Éditions Démo (démo)', 'Plateforme Démo (démo)',
                                      'Atelier Démo (démo)'])[1 + d.n % 3]
WHERE d.n % 4 <> 0;

-- Activité des lecteurs : « À la une » et « Mieux notées » de l'accueil ------------------
-- Douze lecteurs fictifs (e-mails demo.NN@exemple.test). Dates relatives à `now()` : « 7 jours »
-- reste vrai à chaque rechargement.
INSERT INTO app_user (email, google_sub, handle, display_name, role, profile_visibility)
SELECT format('demo.%s@exemple.test', lpad(n::text, 2, '0')),
       format('demo-bulk-sub-%s', lpad(n::text, 2, '0')),
       format('demo_%s', lpad(n::text, 2, '0')),
       format('Lecteur Démo %s', lpad(n::text, 2, '0')),
       'user', 'public'
FROM generate_series(1, 12) AS n;

-- Œuvres 1 à 14 : notées par les douze lecteurs (≥ 10 notes), avec des moyennes différentes.
-- Œuvres 15 à 19 : 3 à 7 ajouts récents (moins de 7 jours), sans note : populaires cette semaine.
WITH demo AS (
  SELECT id, substring(title FROM '(\d+)$')::int AS n FROM work WHERE title LIKE '[Démo] %'
),
readers AS (
  SELECT id, substring(handle::text FROM '(\d+)$')::int AS u FROM app_user WHERE email LIKE 'demo.%@exemple.test'
)
INSERT INTO library_entry (user_id, work_id, status, rating, created_at, updated_at)
SELECT r.id, d.id, 'completed', 10 - (d.n % 5) - (r.u % 3),
       now() - interval '30 days', now() - interval '30 days'
FROM demo d JOIN readers r ON d.n BETWEEN 1 AND 14
UNION ALL
SELECT r.id, d.id, 'reading', NULL,
       now() - (r.u || ' hours')::interval, now() - (r.u || ' hours')::interval
FROM demo d JOIN readers r ON d.n BETWEEN 15 AND 19 AND r.u <= 3 + (d.n % 5);
