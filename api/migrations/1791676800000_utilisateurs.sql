-- Up Migration

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE app_user (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email              text NOT NULL,
  google_sub         text NOT NULL UNIQUE,
  handle             citext NOT NULL UNIQUE,
  display_name       text,
  role               text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  profile_visibility text NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  -- 3 à 30 caractères en minuscules ; la casse est aussi neutralisée par citext.
  CONSTRAINT app_user_handle_format_check CHECK (handle::text ~ '^[a-z0-9_-]{3,30}$'),
  CONSTRAINT app_user_handle_reserved_check CHECK (handle::text NOT IN (
    'admin', 'administrator', 'administrateur', 'moderator', 'moderateur', 'equipe', 'staff',
    'support', 'contact', 'aide', 'help', 'system', 'anonyme', 'root', 'trame', 'api', 'oeuvre'
  ))
);
CREATE UNIQUE INDEX app_user_email_lower_idx ON app_user (lower(email));

-- Archivage d'une œuvre : la colonne existe depuis 0001, la clé étrangère arrive ici.
ALTER TABLE work
  ADD CONSTRAINT work_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES app_user (id);

CREATE TABLE library_entry (
  user_id       bigint NOT NULL REFERENCES app_user (id),
  work_id       bigint NOT NULL REFERENCES work (id),
  status        text NOT NULL CHECK (status IN ('en_cours', 'termine', 'a_lire', 'en_pause', 'abandonne')),
  chapters_read integer NOT NULL DEFAULT 0 CHECK (chapters_read >= 0),
  volumes_read  integer NOT NULL DEFAULT 0 CHECK (volumes_read >= 0),
  rating        smallint CHECK (rating BETWEEN 1 AND 10),
  started_on    date,
  finished_on   date,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);
CREATE INDEX library_entry_work_idx ON library_entry (work_id);

CREATE TABLE reading_event (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES app_user (id),
  work_id        bigint NOT NULL REFERENCES work (id),
  kind           text NOT NULL CHECK (kind IN ('chapters', 'volumes', 'status', 'rating')),
  chapters_added integer,
  volumes_added  integer,
  new_status     text CHECK (new_status IN ('en_cours', 'termine', 'a_lire', 'en_pause', 'abandonne')),
  new_rating     smallint CHECK (new_rating BETWEEN 1 AND 10),
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  -- Seule la colonne correspondant au kind est renseignée.
  CONSTRAINT reading_event_kind_value_check CHECK (
    (kind = 'chapters' AND chapters_added IS NOT NULL AND volumes_added IS NULL AND new_status IS NULL AND new_rating IS NULL)
    OR (kind = 'volumes' AND volumes_added IS NOT NULL AND chapters_added IS NULL AND new_status IS NULL AND new_rating IS NULL)
    OR (kind = 'status' AND new_status IS NOT NULL AND chapters_added IS NULL AND volumes_added IS NULL AND new_rating IS NULL)
    OR (kind = 'rating' AND new_rating IS NOT NULL AND chapters_added IS NULL AND volumes_added IS NULL AND new_status IS NULL)
  )
);
CREATE INDEX reading_event_user_idx ON reading_event (user_id, occurred_at);
CREATE INDEX reading_event_work_idx ON reading_event (work_id);

CREATE TABLE submission (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payload           jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'acceptee', 'refusee')),
  submitted_by      bigint NOT NULL REFERENCES app_user (id),
  reviewed_by       bigint REFERENCES app_user (id),
  dedupe_candidates jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz
);
CREATE INDEX submission_status_idx ON submission (status);
CREATE INDEX submission_submitted_by_idx ON submission (submitted_by);

COMMENT ON TABLE app_user IS 'Compte utilisateur créé à la première connexion Google : identité publique (handle), rôle user/admin, visibilité du profil.';
COMMENT ON COLUMN app_user.handle IS 'Identifiant public unique, insensible à la casse.';
COMMENT ON COLUMN app_user.google_sub IS 'Identifiant du compte Google associé.';
COMMENT ON COLUMN work.deleted_by IS 'Administrateur ayant archivé l''œuvre (avec deleted_at).';

COMMENT ON TABLE library_entry IS 'Suivi d''une œuvre par un utilisateur : statut, chapitres lus, tomes lus, note, dates. Une ligne par couple utilisateur/œuvre.';
COMMENT ON COLUMN library_entry.chapters_read IS 'Chapitres lus. Indépendant de volumes_read : jamais mappé ni additionné.';
COMMENT ON COLUMN library_entry.volumes_read IS 'Tomes lus. Indépendant de chapters_read : jamais mappé ni additionné.';

COMMENT ON TABLE reading_event IS 'Journal en ajout seul des progressions de lecture (historique, bilan annuel), alimenté par l''API.';
COMMENT ON COLUMN reading_event.kind IS 'Ce qui a changé ; seule la colonne de valeur correspondante est renseignée.';

COMMENT ON TABLE submission IS 'Proposition d''œuvre d''un utilisateur, en attente d''une décision de l''administrateur.';
COMMENT ON COLUMN submission.payload IS 'Champs proposés par l''utilisateur, tels que saisis (jsonb).';
COMMENT ON COLUMN submission.dedupe_candidates IS 'Œuvres existantes proches détectées, pour aider à la décision.';

-- Down Migration

DROP TABLE submission;
DROP TABLE reading_event;
DROP TABLE library_entry;
ALTER TABLE work DROP CONSTRAINT work_deleted_by_fkey;
DROP TABLE app_user;
DROP EXTENSION citext;
