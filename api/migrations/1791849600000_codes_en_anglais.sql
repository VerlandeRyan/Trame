-- Up Migration

-- Valeurs d'énumération en anglais (ADR 0007). Chaque bloc : lever le CHECK, convertir les lignes, poser le nouveau CHECK.

-- work.type
ALTER TABLE work DROP CONSTRAINT work_type_check;
UPDATE work SET type = CASE type WHEN 'serie' THEN 'series' WHEN 'recueil' THEN 'collection' ELSE type END;
ALTER TABLE work ADD CONSTRAINT work_type_check CHECK (type IN ('series', 'oneshot', 'webcomic', 'collection'));

-- work.status (côté œuvre)
ALTER TABLE work DROP CONSTRAINT work_status_check;
UPDATE work SET status = CASE status
  WHEN 'a_venir' THEN 'upcoming' WHEN 'en_cours' THEN 'ongoing' WHEN 'termine' THEN 'completed'
  WHEN 'en_pause' THEN 'hiatus' WHEN 'abandonne' THEN 'abandoned' END;
ALTER TABLE work ADD CONSTRAINT work_status_check
  CHECK (status IN ('upcoming', 'ongoing', 'completed', 'hiatus', 'abandoned'));

-- work_relation.relation
ALTER TABLE work_relation DROP CONSTRAINT work_relation_relation_check;
UPDATE work_relation SET relation = CASE relation
  WHEN 'suite' THEN 'sequel' WHEN 'prequelle' THEN 'prequel' WHEN 'spin_off' THEN 'spin_off'
  WHEN 'histoire_annexe' THEN 'side_story' WHEN 'adaptation' THEN 'adaptation'
  WHEN 'version_alternative' THEN 'alternate_version' WHEN 'meme_univers' THEN 'shared_universe'
  WHEN 'contient' THEN 'contains' WHEN 'autre' THEN 'other' END;
ALTER TABLE work_relation ADD CONSTRAINT work_relation_relation_check CHECK (relation IN (
  'sequel', 'prequel', 'spin_off', 'side_story', 'adaptation',
  'alternate_version', 'shared_universe', 'contains', 'other'
));

-- person.kind
ALTER TABLE person DROP CONSTRAINT person_kind_check;
UPDATE person SET kind = CASE kind WHEN 'personne' THEN 'person' WHEN 'collectif' THEN 'collective' END;
ALTER TABLE person ALTER COLUMN kind SET DEFAULT 'person';
ALTER TABLE person ADD CONSTRAINT person_kind_check CHECK (kind IN ('person', 'collective'));

-- work_credit.role
ALTER TABLE work_credit DROP CONSTRAINT work_credit_role_check;
UPDATE work_credit SET role = CASE role
  WHEN 'scenario' THEN 'story' WHEN 'dessin' THEN 'art' WHEN 'couleur' THEN 'colors' WHEN 'autre' THEN 'other' END;
ALTER TABLE work_credit ADD CONSTRAINT work_credit_role_check CHECK (role IN ('story', 'art', 'colors', 'other'));

-- publisher.kind
ALTER TABLE publisher DROP CONSTRAINT publisher_kind_check;
UPDATE publisher SET kind = CASE kind
  WHEN 'editeur' THEN 'publisher' WHEN 'plateforme' THEN 'platform' WHEN 'auto' THEN 'self_published' END;
ALTER TABLE publisher ADD CONSTRAINT publisher_kind_check CHECK (kind IN ('publisher', 'platform', 'self_published'));

-- external_link.kind
ALTER TABLE external_link DROP CONSTRAINT external_link_kind_check;
UPDATE external_link SET kind = CASE kind
  WHEN 'lire' THEN 'read' WHEN 'acheter' THEN 'buy' WHEN 'site' THEN 'website' WHEN 'reseau' THEN 'social' END;
ALTER TABLE external_link ADD CONSTRAINT external_link_kind_check CHECK (kind IN ('read', 'buy', 'website', 'social'));

-- library_entry.status et reading_event.new_status (côté lecteur)
ALTER TABLE library_entry DROP CONSTRAINT library_entry_status_check;
UPDATE library_entry SET status = CASE status
  WHEN 'en_cours' THEN 'reading' WHEN 'termine' THEN 'completed' WHEN 'a_lire' THEN 'plan_to_read'
  WHEN 'en_pause' THEN 'on_hold' WHEN 'abandonne' THEN 'dropped' END;
ALTER TABLE library_entry ADD CONSTRAINT library_entry_status_check
  CHECK (status IN ('reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'));

ALTER TABLE reading_event DROP CONSTRAINT reading_event_new_status_check;
UPDATE reading_event SET new_status = CASE new_status
  WHEN 'en_cours' THEN 'reading' WHEN 'termine' THEN 'completed' WHEN 'a_lire' THEN 'plan_to_read'
  WHEN 'en_pause' THEN 'on_hold' WHEN 'abandonne' THEN 'dropped' END
  WHERE new_status IS NOT NULL;
ALTER TABLE reading_event ADD CONSTRAINT reading_event_new_status_check
  CHECK (new_status IN ('reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'));

-- submission.status
ALTER TABLE submission DROP CONSTRAINT submission_status_check;
UPDATE submission SET status = CASE status
  WHEN 'en_attente' THEN 'pending' WHEN 'acceptee' THEN 'accepted' WHEN 'refusee' THEN 'rejected' END;
ALTER TABLE submission ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE submission ADD CONSTRAINT submission_status_check CHECK (status IN ('pending', 'accepted', 'rejected'));

COMMENT ON TABLE work IS 'Œuvre du catalogue (série, one-shot, webcomic ou recueil) : une œuvre = une fiche. Valeurs d''énumération en anglais.';

-- Down Migration

ALTER TABLE submission DROP CONSTRAINT submission_status_check;
UPDATE submission SET status = CASE status
  WHEN 'pending' THEN 'en_attente' WHEN 'accepted' THEN 'acceptee' WHEN 'rejected' THEN 'refusee' END;
ALTER TABLE submission ALTER COLUMN status SET DEFAULT 'en_attente';
ALTER TABLE submission ADD CONSTRAINT submission_status_check CHECK (status IN ('en_attente', 'acceptee', 'refusee'));

ALTER TABLE reading_event DROP CONSTRAINT reading_event_new_status_check;
UPDATE reading_event SET new_status = CASE new_status
  WHEN 'reading' THEN 'en_cours' WHEN 'completed' THEN 'termine' WHEN 'plan_to_read' THEN 'a_lire'
  WHEN 'on_hold' THEN 'en_pause' WHEN 'dropped' THEN 'abandonne' END
  WHERE new_status IS NOT NULL;
ALTER TABLE reading_event ADD CONSTRAINT reading_event_new_status_check
  CHECK (new_status IN ('en_cours', 'termine', 'a_lire', 'en_pause', 'abandonne'));

ALTER TABLE library_entry DROP CONSTRAINT library_entry_status_check;
UPDATE library_entry SET status = CASE status
  WHEN 'reading' THEN 'en_cours' WHEN 'completed' THEN 'termine' WHEN 'plan_to_read' THEN 'a_lire'
  WHEN 'on_hold' THEN 'en_pause' WHEN 'dropped' THEN 'abandonne' END;
ALTER TABLE library_entry ADD CONSTRAINT library_entry_status_check
  CHECK (status IN ('en_cours', 'termine', 'a_lire', 'en_pause', 'abandonne'));

ALTER TABLE external_link DROP CONSTRAINT external_link_kind_check;
UPDATE external_link SET kind = CASE kind
  WHEN 'read' THEN 'lire' WHEN 'buy' THEN 'acheter' WHEN 'website' THEN 'site' WHEN 'social' THEN 'reseau' END;
ALTER TABLE external_link ADD CONSTRAINT external_link_kind_check CHECK (kind IN ('lire', 'acheter', 'site', 'reseau'));

ALTER TABLE publisher DROP CONSTRAINT publisher_kind_check;
UPDATE publisher SET kind = CASE kind
  WHEN 'publisher' THEN 'editeur' WHEN 'platform' THEN 'plateforme' WHEN 'self_published' THEN 'auto' END;
ALTER TABLE publisher ADD CONSTRAINT publisher_kind_check CHECK (kind IN ('editeur', 'plateforme', 'auto'));

ALTER TABLE work_credit DROP CONSTRAINT work_credit_role_check;
UPDATE work_credit SET role = CASE role
  WHEN 'story' THEN 'scenario' WHEN 'art' THEN 'dessin' WHEN 'colors' THEN 'couleur' WHEN 'other' THEN 'autre' END;
ALTER TABLE work_credit ADD CONSTRAINT work_credit_role_check CHECK (role IN ('scenario', 'dessin', 'couleur', 'autre'));

ALTER TABLE person DROP CONSTRAINT person_kind_check;
UPDATE person SET kind = CASE kind WHEN 'person' THEN 'personne' WHEN 'collective' THEN 'collectif' END;
ALTER TABLE person ALTER COLUMN kind SET DEFAULT 'personne';
ALTER TABLE person ADD CONSTRAINT person_kind_check CHECK (kind IN ('personne', 'collectif'));

ALTER TABLE work_relation DROP CONSTRAINT work_relation_relation_check;
UPDATE work_relation SET relation = CASE relation
  WHEN 'sequel' THEN 'suite' WHEN 'prequel' THEN 'prequelle' WHEN 'spin_off' THEN 'spin_off'
  WHEN 'side_story' THEN 'histoire_annexe' WHEN 'adaptation' THEN 'adaptation'
  WHEN 'alternate_version' THEN 'version_alternative' WHEN 'shared_universe' THEN 'meme_univers'
  WHEN 'contains' THEN 'contient' WHEN 'other' THEN 'autre' END;
ALTER TABLE work_relation ADD CONSTRAINT work_relation_relation_check CHECK (relation IN (
  'suite', 'prequelle', 'spin_off', 'histoire_annexe', 'adaptation',
  'version_alternative', 'meme_univers', 'contient', 'autre'
));

ALTER TABLE work DROP CONSTRAINT work_status_check;
UPDATE work SET status = CASE status
  WHEN 'upcoming' THEN 'a_venir' WHEN 'ongoing' THEN 'en_cours' WHEN 'completed' THEN 'termine'
  WHEN 'hiatus' THEN 'en_pause' WHEN 'abandoned' THEN 'abandonne' END;
ALTER TABLE work ADD CONSTRAINT work_status_check
  CHECK (status IN ('a_venir', 'en_cours', 'termine', 'en_pause', 'abandonne'));

ALTER TABLE work DROP CONSTRAINT work_type_check;
UPDATE work SET type = CASE type WHEN 'series' THEN 'serie' WHEN 'collection' THEN 'recueil' ELSE type END;
ALTER TABLE work ADD CONSTRAINT work_type_check CHECK (type IN ('serie', 'oneshot', 'webcomic', 'recueil'));

COMMENT ON TABLE work IS 'Œuvre du catalogue (série, one-shot, webcomic ou recueil) : une œuvre = une fiche.';
