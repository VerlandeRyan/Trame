-- Up Migration

-- Comme `work`, une personne et un éditeur portent une version (deux administrateurs qui
-- modifient la même fiche ne s'écrasent plus en silence) et l'administrateur qui les a archivés.
ALTER TABLE person ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE publisher ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE person ADD COLUMN deleted_by bigint REFERENCES app_user (id);
ALTER TABLE publisher ADD COLUMN deleted_by bigint REFERENCES app_user (id);

COMMENT ON COLUMN person.updated_at IS 'Version de la fiche : déplacée à chaque modification, publication, archivage et restauration.';
COMMENT ON COLUMN publisher.updated_at IS 'Version de la fiche : déplacée à chaque modification, publication, archivage et restauration.';
COMMENT ON COLUMN person.deleted_by IS 'Administrateur ayant archivé la personne (avec deleted_at).';
COMMENT ON COLUMN publisher.deleted_by IS 'Administrateur ayant archivé l''éditeur (avec deleted_at).';

-- Down Migration

ALTER TABLE publisher DROP COLUMN deleted_by;
ALTER TABLE person DROP COLUMN deleted_by;
ALTER TABLE publisher DROP COLUMN updated_at;
ALTER TABLE person DROP COLUMN updated_at;
