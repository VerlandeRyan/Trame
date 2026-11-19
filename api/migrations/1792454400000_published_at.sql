-- Up Migration

-- Une fiche créée en brouillon n'est visible que dans l'administration jusqu'à sa publication.
-- Le défaut `now()` publie les lignes insérées sans état (jeu de démonstration, fiches existantes).
ALTER TABLE work ADD COLUMN published_at timestamptz DEFAULT now();
ALTER TABLE person ADD COLUMN published_at timestamptz DEFAULT now();
ALTER TABLE publisher ADD COLUMN published_at timestamptz DEFAULT now();

-- Un brouillon se supprime, il ne s'archive pas.
ALTER TABLE work ADD CONSTRAINT work_draft_not_archived CHECK (published_at IS NOT NULL OR deleted_at IS NULL);
ALTER TABLE person ADD CONSTRAINT person_draft_not_archived CHECK (published_at IS NOT NULL OR deleted_at IS NULL);
ALTER TABLE publisher ADD CONSTRAINT publisher_draft_not_archived CHECK (published_at IS NOT NULL OR deleted_at IS NULL);

-- Les brouillons sont rares : l'index partiel sert la liste et le décompte sans coûter aux lectures publiques.
CREATE INDEX work_draft_idx ON work (id) WHERE published_at IS NULL;
CREATE INDEX person_draft_idx ON person (id) WHERE published_at IS NULL;
CREATE INDEX publisher_draft_idx ON publisher (id) WHERE published_at IS NULL;

COMMENT ON COLUMN work.published_at IS 'Date de publication ; NULL = brouillon, invisible du public ; distinct de deleted_at.';
COMMENT ON COLUMN person.published_at IS 'Date de publication ; NULL = brouillon, invisible du public ; distinct de deleted_at.';
COMMENT ON COLUMN publisher.published_at IS 'Date de publication ; NULL = brouillon, invisible du public ; distinct de deleted_at.';

-- Down Migration

DROP INDEX publisher_draft_idx;
DROP INDEX person_draft_idx;
DROP INDEX work_draft_idx;
ALTER TABLE publisher DROP CONSTRAINT publisher_draft_not_archived;
ALTER TABLE person DROP CONSTRAINT person_draft_not_archived;
ALTER TABLE work DROP CONSTRAINT work_draft_not_archived;
ALTER TABLE publisher DROP COLUMN published_at;
ALTER TABLE person DROP COLUMN published_at;
ALTER TABLE work DROP COLUMN published_at;
