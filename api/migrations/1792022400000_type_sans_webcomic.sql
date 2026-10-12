-- Up Migration

-- ADR 0007 : le type dit la structure de l'histoire (série, one-shot, anthologie). `webcomic` est un
-- format de publication : il rejoint la table des formats, et `collection` devient `anthology`.
ALTER TABLE work DROP CONSTRAINT work_type_check;

INSERT INTO genre (code, category) VALUES ('webcomic', 'format') ON CONFLICT (code) DO NOTHING;
INSERT INTO work_genre (work_id, genre_id)
SELECT w.id, g.id FROM work w JOIN genre g ON g.code = 'webcomic' WHERE w.type = 'webcomic'
ON CONFLICT DO NOTHING;

UPDATE work SET type = CASE type WHEN 'webcomic' THEN 'series' WHEN 'collection' THEN 'anthology' ELSE type END;
ALTER TABLE work ADD CONSTRAINT work_type_check CHECK (type IN ('series', 'oneshot', 'anthology'));

COMMENT ON TABLE work IS 'Œuvre du catalogue (série, one-shot ou anthologie) : une œuvre = une fiche. Le format et les genres sont dans genre / work_genre.';

-- Down Migration

ALTER TABLE work DROP CONSTRAINT work_type_check;
UPDATE work SET type = CASE type WHEN 'anthology' THEN 'collection' ELSE type END;
UPDATE work SET type = 'webcomic'
 WHERE type = 'series'
   AND id IN (SELECT wg.work_id FROM work_genre wg JOIN genre g ON g.id = wg.genre_id WHERE g.code = 'webcomic');
ALTER TABLE work ADD CONSTRAINT work_type_check CHECK (type IN ('series', 'oneshot', 'webcomic', 'collection'));

COMMENT ON TABLE work IS 'Œuvre du catalogue (série, one-shot, webcomic ou recueil) : une œuvre = une fiche. Valeurs d''énumération en anglais.';
