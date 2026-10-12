-- Up Migration

-- ADR 0007 : un genre a un code stable (slug anglais) et une catégorie ; les libellés sont traduits côté front.
-- `format` = tradition / mode de publication (manga, manhwa, bd, webtoon, webcomic) ; `theme` = genre thématique.
ALTER TABLE genre ADD COLUMN code text;
ALTER TABLE genre ADD COLUMN category text;
UPDATE genre
   SET code = trim(both '_' from regexp_replace(lower(immutable_unaccent(label)), '[^a-z0-9]+', '_', 'g'));
UPDATE genre
   SET category = CASE WHEN code IN ('manga', 'manhwa', 'manhua', 'bd', 'comics', 'webtoon', 'webcomic')
                       THEN 'format' ELSE 'theme' END;
ALTER TABLE genre ALTER COLUMN code SET NOT NULL;
ALTER TABLE genre ALTER COLUMN category SET NOT NULL;
ALTER TABLE genre ADD CONSTRAINT genre_code_key UNIQUE (code);
ALTER TABLE genre ADD CONSTRAINT genre_code_format_check CHECK (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$');
ALTER TABLE genre ADD CONSTRAINT genre_category_check CHECK (category IN ('format', 'theme'));
ALTER TABLE genre DROP COLUMN label;

COMMENT ON TABLE genre IS 'Genre ou format de publication, identifié par un code stable en anglais ; le libellé est traduit côté front.';
COMMENT ON COLUMN genre.code IS 'Slug stable en anglais (minuscules, chiffres, underscores) : sert de clé dans les URL et l''API.';
COMMENT ON COLUMN genre.category IS 'format (manga, manhwa, bd, webtoon, webcomic…) ou theme (fantasy, humor…).';

-- Down Migration

ALTER TABLE genre ADD COLUMN label text;
UPDATE genre SET label = code;
ALTER TABLE genre ALTER COLUMN label SET NOT NULL;
ALTER TABLE genre ADD CONSTRAINT genre_label_key UNIQUE (label);
ALTER TABLE genre DROP COLUMN category;
ALTER TABLE genre DROP COLUMN code;

COMMENT ON TABLE genre IS 'Étiquette de classement (manga, BD, fantasy…) utilisée par les filtres.';
