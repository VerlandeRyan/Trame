-- Up Migration

COMMENT ON TABLE work IS 'Œuvre du catalogue (série, one-shot, webcomic ou recueil) : une œuvre = une fiche.';
COMMENT ON COLUMN work.chapters IS 'Total de chapitres, renseigné seulement quand l''œuvre est terminée (NULL = inconnu).';
COMMENT ON COLUMN work.volumes IS 'Total de tomes, renseigné seulement quand l''œuvre est terminée (NULL = inconnu).';
COMMENT ON COLUMN work.cover_consent IS 'Accord de l''auteur ou de l''éditeur pour afficher la couverture.';
COMMENT ON COLUMN work.deleted_at IS 'Archivage : l''œuvre n''apparaît plus dans les listes publiques.';

COMMENT ON TABLE work_title IS 'Titres alternatifs d''une œuvre (traduction, ancien titre, titre court), utilisés par la recherche.';
COMMENT ON TABLE work_relation IS 'Lien orienté entre deux œuvres, lu « work_id — relation — related_work_id » ; l''inverse est déduit à l''affichage.';
COMMENT ON TABLE person IS 'Auteur ou collectif, sous le nom sous lequel il est crédité.';
COMMENT ON TABLE work_credit IS 'Crédit d''une personne sur une œuvre, avec son rôle (scénario, dessin, couleur, autre).';
COMMENT ON TABLE publisher IS 'Maison d''édition, plateforme de lecture ou entrée « auto-édition ».';
COMMENT ON TABLE work_publisher IS 'Association œuvre — éditeur ou plateforme ; une œuvre peut en avoir plusieurs ou aucun.';
COMMENT ON TABLE genre IS 'Étiquette de classement (manga, BD, fantasy…) utilisée par les filtres.';
COMMENT ON TABLE work_genre IS 'Association œuvre — genre.';
COMMENT ON TABLE external_link IS 'Lien externe (lire, acheter, site, réseau) rattaché soit à une œuvre, soit à une personne.';

-- Down Migration

COMMENT ON TABLE work IS NULL;
COMMENT ON COLUMN work.chapters IS NULL;
COMMENT ON COLUMN work.volumes IS NULL;
COMMENT ON COLUMN work.cover_consent IS NULL;
COMMENT ON COLUMN work.deleted_at IS NULL;
COMMENT ON TABLE work_title IS NULL;
COMMENT ON TABLE work_relation IS NULL;
COMMENT ON TABLE person IS NULL;
COMMENT ON TABLE work_credit IS NULL;
COMMENT ON TABLE publisher IS NULL;
COMMENT ON TABLE work_publisher IS NULL;
COMMENT ON TABLE genre IS NULL;
COMMENT ON TABLE work_genre IS NULL;
COMMENT ON TABLE external_link IS NULL;
