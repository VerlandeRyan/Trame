-- Up Migration

-- ADR 0007 : langue originale par œuvre, titres localisés (langue + nature), synopsis par langue avec sa source.
-- Les données existantes sont françaises : le backfill utilise `fr`.
ALTER TABLE work ADD COLUMN original_language text;
UPDATE work SET original_language = 'fr';
ALTER TABLE work ALTER COLUMN original_language SET NOT NULL;
ALTER TABLE work ADD CONSTRAINT work_original_language_check CHECK (original_language ~ '^[a-z]{2,3}$');

ALTER TABLE work_title ADD COLUMN language text;
ALTER TABLE work_title ADD COLUMN kind text;
UPDATE work_title SET language = 'fr', kind = 'translated';
ALTER TABLE work_title ALTER COLUMN language SET NOT NULL;
ALTER TABLE work_title ALTER COLUMN kind SET NOT NULL;
ALTER TABLE work_title ADD CONSTRAINT work_title_language_check CHECK (language ~ '^[a-z]{2,3}$');
ALTER TABLE work_title ADD CONSTRAINT work_title_kind_check CHECK (kind IN ('translated', 'international', 'former', 'short'));
ALTER TABLE work_title DROP CONSTRAINT work_title_pkey;
ALTER TABLE work_title ADD PRIMARY KEY (work_id, language, title);

CREATE TABLE work_synopsis (
  work_id   bigint NOT NULL REFERENCES work (id) ON DELETE CASCADE,
  language  text   NOT NULL,
  text      text   NOT NULL,
  source    text   NOT NULL,
  PRIMARY KEY (work_id, language),
  CONSTRAINT work_synopsis_language_check CHECK (language ~ '^[a-z]{2,3}$'),
  CONSTRAINT work_synopsis_source_check CHECK (source IN ('official', 'human', 'machine')),
  CONSTRAINT work_synopsis_text_check CHECK (length(btrim(text)) > 0)
);

INSERT INTO work_synopsis (work_id, language, text, source)
SELECT id, original_language, synopsis, 'official' FROM work WHERE synopsis IS NOT NULL AND btrim(synopsis) <> '';
ALTER TABLE work DROP COLUMN synopsis;

COMMENT ON COLUMN work.original_language IS 'Langue originale de l''œuvre (code ISO 639, minuscules) ; `title` est le titre dans cette langue. Sans défaut : à renseigner explicitement.';
COMMENT ON TABLE work_title IS 'Titres alternatifs d''une œuvre par langue (traduction, titre international, ancien titre, titre court), utilisés par la recherche et l''affichage localisé.';
COMMENT ON COLUMN work_title.language IS 'Langue du titre (code ISO 639, minuscules).';
COMMENT ON COLUMN work_title.kind IS 'translated, international, former ou short.';
COMMENT ON TABLE work_synopsis IS 'Synopsis d''une œuvre dans une langue ; repli sur la langue originale côté API.';
COMMENT ON COLUMN work_synopsis.source IS 'official (éditeur ou auteur), human (contributeur) ou machine (traduction automatique).';

-- Down Migration

ALTER TABLE work ADD COLUMN synopsis text;
UPDATE work SET synopsis = s.text
  FROM work_synopsis s
 WHERE s.work_id = work.id AND s.language = work.original_language;
DROP TABLE work_synopsis;

-- Une seule ligne par (work_id, title) pour restaurer l'ancienne clé primaire.
DELETE FROM work_title a USING work_title b
 WHERE a.work_id = b.work_id AND a.title = b.title
   AND (a.language, a.kind) > (b.language, b.kind);
ALTER TABLE work_title DROP CONSTRAINT work_title_pkey;
ALTER TABLE work_title DROP CONSTRAINT work_title_kind_check;
ALTER TABLE work_title DROP CONSTRAINT work_title_language_check;
ALTER TABLE work_title DROP COLUMN kind;
ALTER TABLE work_title DROP COLUMN language;
ALTER TABLE work_title ADD PRIMARY KEY (work_id, title);

ALTER TABLE work DROP CONSTRAINT work_original_language_check;
ALTER TABLE work DROP COLUMN original_language;

COMMENT ON TABLE work_title IS 'Titres alternatifs d''une œuvre (traduction, ancien titre, titre court), utilisés par la recherche.';
