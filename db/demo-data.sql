-- Jeu de démonstration FICTIF de Trame.
-- Tous les titres, noms, éditeurs et comptes ci-dessous sont inventés ; les adresses
-- e-mail utilisent le domaine réservé exemple.test. Ne jamais y recopier de donnée réelle.
-- Rejouable : vide d'abord les tables concernées (jamais sur une base contenant des données à garder).
-- Chargement : `npm run db:seed` depuis api/.

TRUNCATE submission, reading_event, library_entry, external_link, work_genre, genre,
  work_publisher, publisher, work_credit, person, work_relation, work_title, work, app_user
  RESTART IDENTITY CASCADE;

-- Utilisateurs fictifs -------------------------------------------------------
INSERT INTO app_user (email, google_sub, handle, display_name, role, profile_visibility) VALUES
  ('admin@exemple.test',    'demo-sub-admin',    'admin_demo',    'Admin Démo',    'admin', 'public'),
  ('lectrice@exemple.test', 'demo-sub-lectrice', 'lectrice_demo', 'Lectrice Démo', 'user',  'public'),
  ('lecteur@exemple.test',  'demo-sub-lecteur',  'lecteur_demo',  'Lecteur Démo',  'user',  'private');

-- Œuvres ---------------------------------------------------------------------
-- Les totaux chapters/volumes ne sont renseignés que pour les œuvres terminées.
INSERT INTO work (title, type, status, synopsis, chapters, volumes, started_on, ended_on) VALUES
  ('Les Lanternes de Brume',        'webcomic', 'termine',  'Une apprentie allumeuse de lanternes découvre ce qui vit dans la brume.', 120, 3, '2019-03-01', '2023-06-30'),
  ('Chroniques de Basalte',         'serie',    'en_cours', 'Un cartographe suit une faille qui dévore les routes.',                  NULL, NULL, '2021-01-15', NULL),
  ('Cap sur les Archipels',         'serie',    'en_cours', 'Un équipage de fortune et ses îles qui changent de place.',              NULL, NULL, '2022-09-01', NULL),
  ('Le Gardien des Sables',         'serie',    'en_cours', 'Un veilleur de dunes et le désert qui se souvient.',                     NULL, NULL, '2023-02-10', NULL),
  ('Carnet de Colportage',          'oneshot',  'termine',  'Les étapes d''une vendeuse ambulante sur une route qui n''existe pas.',  NULL, 1,    '2020-05-01', '2020-05-01'),
  ('Basalte – Histoires de Cendre', 'oneshot',  'termine',  'Hors-série sur les villages abandonnés de la faille.',                   NULL, 1,    '2023-11-01', '2023-11-01'),
  ('Basalte – Le Recueil des Braises', 'recueil', 'termine', 'Histoires courtes d''auteurs invités autour de Basalte.',                NULL, 1,    '2024-04-01', '2024-04-01'),
  ('Étoile Vagabonde',              'serie',    'en_cours', 'Une comète habitée traverse le ciel d''un monde qui l''ignore.',        NULL, NULL, '2020-10-01', NULL),
  ('Étoile Vagabonde – Aube',       'serie',    'en_cours', 'Avant la comète : les premiers observateurs.',                          NULL, NULL, '2023-05-01', NULL),
  ('Étoile Vagabonde – Crépuscule', 'serie',    'en_cours', 'Après la comète : ce qu''elle a laissé derrière elle.',                 NULL, NULL, '2024-01-10', NULL);

INSERT INTO work_title (work_id, title)
SELECT w.id, t.title FROM (VALUES
  ('Les Lanternes de Brume', 'The Fog Lanterns'),
  ('Chroniques de Basalte',  'Basalte')
) AS t(work_title, title) JOIN work w ON w.title = t.work_title;

-- Personnes ------------------------------------------------------------------
INSERT INTO person (name, kind) VALUES
  ('Mélodie Vasseur',  'personne'),
  ('Théo Marchand',    'personne'),
  ('Inès Calvet',      'personne'),
  ('Yanis Roux',       'personne'),
  ('Noé Lambert',      'personne'),
  ('Léa Fontaine',     'personne'),
  ('Ambre Duval',      'personne'),
  ('Collectif Étincelle', 'collectif');

-- Un auteur peut être crédité deux fois sur la même œuvre (scénario et dessin).
INSERT INTO work_credit (work_id, person_id, role)
SELECT w.id, p.id, c.role FROM (VALUES
  ('Les Lanternes de Brume',           'Mélodie Vasseur', 'scenario'),
  ('Les Lanternes de Brume',           'Mélodie Vasseur', 'dessin'),
  ('Chroniques de Basalte',            'Théo Marchand',   'scenario'),
  ('Chroniques de Basalte',            'Théo Marchand',   'dessin'),
  ('Cap sur les Archipels',            'Inès Calvet',     'scenario'),
  ('Cap sur les Archipels',            'Yanis Roux',      'dessin'),
  ('Le Gardien des Sables',            'Inès Calvet',     'scenario'),
  ('Le Gardien des Sables',            'Noé Lambert',     'dessin'),
  ('Carnet de Colportage',             'Léa Fontaine',    'scenario'),
  ('Carnet de Colportage',             'Léa Fontaine',    'dessin'),
  ('Basalte – Histoires de Cendre',    'Théo Marchand',   'scenario'),
  ('Basalte – Histoires de Cendre',    'Léa Fontaine',    'dessin'),
  ('Basalte – Le Recueil des Braises', 'Théo Marchand',   'dessin'),
  ('Basalte – Le Recueil des Braises', 'Noé Lambert',     'autre'),
  ('Basalte – Le Recueil des Braises', 'Collectif Étincelle', 'autre'),
  ('Étoile Vagabonde',                 'Ambre Duval',     'scenario'),
  ('Étoile Vagabonde',                 'Ambre Duval',     'dessin'),
  ('Étoile Vagabonde – Aube',          'Ambre Duval',     'scenario'),
  ('Étoile Vagabonde – Aube',          'Noé Lambert',     'dessin'),
  ('Étoile Vagabonde – Crépuscule',    'Yanis Roux',      'dessin'),
  ('Étoile Vagabonde – Crépuscule',    'Ambre Duval',     'scenario')
) AS c(work_title, person_name, role)
  JOIN work w ON w.title = c.work_title
  JOIN person p ON p.name = c.person_name;

-- Éditeurs et plateformes ------------------------------------------------------
INSERT INTO publisher (name, kind, url) VALUES
  ('Planche Ouverte (fictive)',    'plateforme', 'https://planche-ouverte.exemple.test'),
  ('Éditions Marais Bleu (fictives)', 'editeur', 'https://marais-bleu.exemple.test'),
  ('Atelier de Léa Fontaine',      'auto',       NULL);

-- Un même éditeur pour plusieurs œuvres ; une œuvre avec plateforme et éditeur papier.
INSERT INTO work_publisher (work_id, publisher_id)
SELECT w.id, p.id FROM (VALUES
  ('Les Lanternes de Brume',           'Planche Ouverte (fictive)'),
  ('Les Lanternes de Brume',           'Éditions Marais Bleu (fictives)'),
  ('Chroniques de Basalte',            'Éditions Marais Bleu (fictives)'),
  ('Cap sur les Archipels',            'Éditions Marais Bleu (fictives)'),
  ('Le Gardien des Sables',            'Éditions Marais Bleu (fictives)'),
  ('Basalte – Le Recueil des Braises', 'Éditions Marais Bleu (fictives)'),
  ('Étoile Vagabonde',                 'Éditions Marais Bleu (fictives)'),
  ('Carnet de Colportage',             'Atelier de Léa Fontaine'),
  ('Basalte – Histoires de Cendre',    'Atelier de Léa Fontaine')
) AS c(work_title, publisher_name)
  JOIN work w ON w.title = c.work_title
  JOIN publisher p ON p.name = c.publisher_name;

-- Genres -----------------------------------------------------------------------
INSERT INTO genre (label) VALUES ('manga'), ('BD'), ('webtoon'), ('fantasy'), ('humour');

INSERT INTO work_genre (work_id, genre_id)
SELECT w.id, g.id FROM (VALUES
  ('Les Lanternes de Brume',           'webtoon'),
  ('Les Lanternes de Brume',           'fantasy'),
  ('Chroniques de Basalte',            'manga'),
  ('Chroniques de Basalte',            'fantasy'),
  ('Cap sur les Archipels',            'BD'),
  ('Cap sur les Archipels',            'humour'),
  ('Le Gardien des Sables',            'manga'),
  ('Carnet de Colportage',             'BD'),
  ('Basalte – Histoires de Cendre',    'manga'),
  ('Basalte – Le Recueil des Braises', 'manga'),
  ('Étoile Vagabonde',                 'manga'),
  ('Étoile Vagabonde – Aube',          'manga'),
  ('Étoile Vagabonde – Crépuscule',    'manga')
) AS c(work_title, label)
  JOIN work w ON w.title = c.work_title
  JOIN genre g ON g.label = c.label;

-- Relations entre œuvres (un seul sens stocké) ------------------------------------
INSERT INTO work_relation (work_id, related_work_id, relation)
SELECT a.id, b.id, c.relation FROM (VALUES
  ('Basalte – Histoires de Cendre',    'Chroniques de Basalte',         'spin_off'),
  ('Basalte – Le Recueil des Braises', 'Basalte – Histoires de Cendre', 'contient'),
  ('Basalte – Le Recueil des Braises', 'Chroniques de Basalte',         'meme_univers'),
  ('Étoile Vagabonde – Aube',          'Étoile Vagabonde',              'spin_off'),
  ('Étoile Vagabonde – Crépuscule',    'Étoile Vagabonde',              'spin_off')
) AS c(from_title, to_title, relation)
  JOIN work a ON a.title = c.from_title
  JOIN work b ON b.title = c.to_title;

-- Liens externes (https uniquement) --------------------------------------------------
INSERT INTO external_link (work_id, kind, url, label)
SELECT w.id, c.kind, c.url, c.label FROM (VALUES
  ('Les Lanternes de Brume', 'lire',    'https://planche-ouverte.exemple.test/lanternes', 'Lire sur Planche Ouverte'),
  ('Les Lanternes de Brume', 'acheter', 'https://marais-bleu.exemple.test/lanternes',     'Acheter les tomes'),
  ('Carnet de Colportage',   'site',    'https://lea-fontaine.exemple.test',             'Site de l''autrice')
) AS c(work_title, kind, url, label) JOIN work w ON w.title = c.work_title;

INSERT INTO external_link (person_id, kind, url, label)
SELECT p.id, 'reseau', 'https://reseau.exemple.test/theo-marchand', 'Profil de l''auteur'
FROM person p WHERE p.name = 'Théo Marchand';

-- Suivi des lecteurs : chapitres lus et tomes lus sont indépendants ----------------------
INSERT INTO library_entry (user_id, work_id, status, chapters_read, volumes_read, rating, started_on, finished_on)
SELECT u.id, w.id, c.status, c.chapters_read, c.volumes_read, c.rating, c.started_on::date, c.finished_on::date
FROM (VALUES
  ('lectrice_demo', 'Chroniques de Basalte',     'en_cours', 40,  3, 9,    '2024-02-01', NULL),
  ('lectrice_demo', 'Les Lanternes de Brume',    'termine',  120, 0, 8,    '2023-07-01', '2023-09-15'),
  ('lectrice_demo', 'Cap sur les Archipels',     'a_lire',   0,   0, NULL, NULL,         NULL),
  ('lecteur_demo',  'Chroniques de Basalte',     'en_pause', 12,  1, NULL, '2024-05-01', NULL),
  ('lecteur_demo',  'Carnet de Colportage',      'termine',  0,   1, 7,    '2024-06-01', '2024-06-02')
) AS c(handle, work_title, status, chapters_read, volumes_read, rating, started_on, finished_on)
  JOIN app_user u ON u.handle = c.handle
  JOIN work w ON w.title = c.work_title;

-- Journal en ajout seul : un seul champ de valeur renseigné selon le kind ------------------
INSERT INTO reading_event (user_id, work_id, kind, chapters_added, volumes_added, new_status, new_rating, occurred_at)
SELECT u.id, w.id, c.kind, c.chapters_added, c.volumes_added, c.new_status, c.new_rating, c.occurred_at::timestamptz
FROM (VALUES
  ('lectrice_demo', 'Chroniques de Basalte',  'chapters', 5,    NULL, NULL,      NULL, '2024-03-01T20:00:00Z'),
  ('lectrice_demo', 'Chroniques de Basalte',  'volumes',  NULL, 1,    NULL,      NULL, '2024-03-02T09:30:00Z'),
  ('lectrice_demo', 'Les Lanternes de Brume', 'status',   NULL, NULL, 'termine', NULL, '2023-09-15T18:00:00Z'),
  ('lectrice_demo', 'Les Lanternes de Brume', 'rating',   NULL, NULL, NULL,      8,    '2023-09-15T18:05:00Z')
) AS c(handle, work_title, kind, chapters_added, volumes_added, new_status, new_rating, occurred_at)
  JOIN app_user u ON u.handle = c.handle
  JOIN work w ON w.title = c.work_title;

-- Proposition d'un lecteur, en attente de décision ------------------------------------------
INSERT INTO submission (payload, status, submitted_by, dedupe_candidates)
SELECT '{"title": "Les Voiliers de Cendre", "type": "oneshot", "authors": ["Autrice Inventée"]}'::jsonb,
       'en_attente', u.id,
       '[{"title": "Basalte – Histoires de Cendre"}]'::jsonb
FROM app_user u WHERE u.handle = 'lecteur_demo';
