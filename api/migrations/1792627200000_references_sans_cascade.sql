-- Up Migration

-- Une fiche citée par une autre (personne créditée, éditeur listé, œuvre liée) ne se supprime plus
-- en emportant les lignes qui la citent : la base refuse (23503). Seules restent en cascade les
-- lignes propres à la fiche supprimée (ses titres, crédits, liens…). `NO ACTION` plutôt que
-- `RESTRICT` : même refus, mais vérifié en fin d'énoncé, donc supprimer d'un coup des œuvres qui se
-- citent entre elles reste possible.
ALTER TABLE work_credit
  DROP CONSTRAINT work_credit_person_id_fkey,
  ADD CONSTRAINT work_credit_person_id_fkey FOREIGN KEY (person_id) REFERENCES person (id);
ALTER TABLE work_publisher
  DROP CONSTRAINT work_publisher_publisher_id_fkey,
  ADD CONSTRAINT work_publisher_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES publisher (id);
ALTER TABLE work_relation
  DROP CONSTRAINT work_relation_related_work_id_fkey,
  ADD CONSTRAINT work_relation_related_work_id_fkey FOREIGN KEY (related_work_id) REFERENCES work (id);

-- Down Migration

ALTER TABLE work_relation
  DROP CONSTRAINT work_relation_related_work_id_fkey,
  ADD CONSTRAINT work_relation_related_work_id_fkey FOREIGN KEY (related_work_id) REFERENCES work (id) ON DELETE CASCADE;
ALTER TABLE work_publisher
  DROP CONSTRAINT work_publisher_publisher_id_fkey,
  ADD CONSTRAINT work_publisher_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES publisher (id) ON DELETE CASCADE;
ALTER TABLE work_credit
  DROP CONSTRAINT work_credit_person_id_fkey,
  ADD CONSTRAINT work_credit_person_id_fkey FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE;
