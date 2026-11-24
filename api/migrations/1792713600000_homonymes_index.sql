-- Up Migration

-- Recherche des homonymes de l'administration : égalité sur le nom sans casse, accents ni espaces
-- superflus (suites d'espaces, y compris insécables (chr(160)), ramenées à une seule, aucune aux extrémités).
-- L'expression est celle du dépôt (`findNamesakes`) : la changer d'un côté seulement rend l'index inutile.
CREATE INDEX work_title_namesake_idx ON work (lower(btrim(regexp_replace(translate(immutable_unaccent(title), chr(160), ' '), '[[:space:]]+', ' ', 'g'))));
CREATE INDEX person_name_namesake_idx ON person (lower(btrim(regexp_replace(translate(immutable_unaccent(name), chr(160), ' '), '[[:space:]]+', ' ', 'g'))));
CREATE INDEX publisher_name_namesake_idx ON publisher (lower(btrim(regexp_replace(translate(immutable_unaccent(name), chr(160), ' '), '[[:space:]]+', ' ', 'g'))));

-- Down Migration

DROP INDEX publisher_name_namesake_idx;
DROP INDEX person_name_namesake_idx;
DROP INDEX work_title_namesake_idx;
