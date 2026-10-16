-- Up Migration

-- « À la une » compte les ajouts récents ; `updated_at` bouge à chaque progression.
ALTER TABLE library_entry ADD COLUMN created_at timestamptz;
UPDATE library_entry SET created_at = updated_at WHERE created_at IS NULL;
ALTER TABLE library_entry ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE library_entry ALTER COLUMN created_at SET DEFAULT now();
CREATE INDEX library_entry_created_idx ON library_entry (created_at);

COMMENT ON COLUMN library_entry.created_at IS 'Date d''ajout de l''œuvre à la liste (popularité de la semaine) ; ne change jamais ensuite.';

-- Down Migration

DROP INDEX library_entry_created_idx;
ALTER TABLE library_entry DROP COLUMN created_at;
