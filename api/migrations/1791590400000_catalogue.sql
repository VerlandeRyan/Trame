-- Up Migration

-- Recherche : insensible à la casse et aux accents.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() n'est pas IMMUTABLE : enveloppe nécessaire pour indexer.
CREATE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE TABLE work (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            text NOT NULL,
  type             text NOT NULL CHECK (type IN ('serie', 'oneshot', 'webcomic', 'recueil')),
  status           text NOT NULL CHECK (status IN ('a_venir', 'en_cours', 'termine', 'en_pause', 'abandonne')),
  synopsis         text,
  chapters         integer CHECK (chapters >= 0),
  volumes          integer CHECK (volumes >= 0),
  started_on       date,
  ended_on         date,
  cover_path       text,
  cover_source_url text,
  cover_consent    boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  -- La clé étrangère vers app_user est ajoutée par la migration 0002.
  deleted_by       bigint,
  CONSTRAINT work_dates_check CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);
CREATE INDEX work_type_idx ON work (type);
CREATE INDEX work_status_idx ON work (status);
CREATE INDEX work_deleted_at_idx ON work (deleted_at);
CREATE INDEX work_title_trgm_idx ON work USING gin (immutable_unaccent(title) gin_trgm_ops);

CREATE TABLE work_title (
  work_id bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  title   text NOT NULL,
  PRIMARY KEY (work_id, title)
);
CREATE INDEX work_title_title_trgm_idx ON work_title USING gin (immutable_unaccent(title) gin_trgm_ops);

CREATE TABLE work_relation (
  work_id         bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  related_work_id bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  relation        text NOT NULL CHECK (relation IN (
    'suite', 'prequelle', 'spin_off', 'histoire_annexe', 'adaptation',
    'version_alternative', 'meme_univers', 'contient', 'autre'
  )),
  PRIMARY KEY (work_id, related_work_id, relation),
  CONSTRAINT work_relation_distinct_check CHECK (work_id <> related_work_id)
);
CREATE INDEX work_relation_related_idx ON work_relation (related_work_id);

CREATE TABLE person (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'personne' CHECK (kind IN ('personne', 'collectif')),
  deleted_at timestamptz
);
CREATE INDEX person_name_trgm_idx ON person USING gin (immutable_unaccent(name) gin_trgm_ops);

CREATE TABLE work_credit (
  work_id   bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('scenario', 'dessin', 'couleur', 'autre')),
  PRIMARY KEY (work_id, person_id, role)
);
CREATE INDEX work_credit_person_idx ON work_credit (person_id);

CREATE TABLE publisher (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('editeur', 'plateforme', 'auto')),
  url        text,
  deleted_at timestamptz
);
CREATE INDEX publisher_name_trgm_idx ON publisher USING gin (immutable_unaccent(name) gin_trgm_ops);

CREATE TABLE work_publisher (
  work_id      bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  publisher_id bigint NOT NULL REFERENCES publisher (id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, publisher_id)
);
CREATE INDEX work_publisher_publisher_idx ON work_publisher (publisher_id);

CREATE TABLE genre (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL UNIQUE
);

CREATE TABLE work_genre (
  work_id  bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  genre_id bigint NOT NULL REFERENCES genre (id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, genre_id)
);
CREATE INDEX work_genre_genre_idx ON work_genre (genre_id);

CREATE TABLE external_link (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id   bigint REFERENCES work (id) ON DELETE CASCADE,
  person_id bigint REFERENCES person (id) ON DELETE CASCADE,
  kind      text NOT NULL CHECK (kind IN ('lire', 'acheter', 'site', 'reseau')),
  url       text NOT NULL CHECK (url LIKE 'https://%'),
  label     text,
  CONSTRAINT external_link_target_check CHECK ((work_id IS NOT NULL) <> (person_id IS NOT NULL))
);
CREATE INDEX external_link_work_idx ON external_link (work_id);
CREATE INDEX external_link_person_idx ON external_link (person_id);

-- Down Migration

DROP TABLE external_link;
DROP TABLE work_genre;
DROP TABLE genre;
DROP TABLE work_publisher;
DROP TABLE publisher;
DROP TABLE work_credit;
DROP TABLE person;
DROP TABLE work_relation;
DROP TABLE work_title;
DROP TABLE work;
DROP FUNCTION immutable_unaccent(text);
DROP EXTENSION unaccent;
DROP EXTENSION pg_trgm;
