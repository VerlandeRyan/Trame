-- Up Migration

CREATE TABLE session (
  sid    text PRIMARY KEY,
  sess   jsonb NOT NULL,
  expire timestamptz NOT NULL
);
CREATE INDEX session_expire_idx ON session (expire);

COMMENT ON TABLE session IS 'Sessions de connexion (cookie httpOnly) : identifiant opaque, contenu et expiration. Révocable en supprimant la ligne.';
COMMENT ON COLUMN session.sess IS 'Contenu de la session : identifiant de l''utilisateur connecté, ou identité Google en attente du choix du handle (10 min).';
COMMENT ON COLUMN session.expire IS 'Au-delà, la session est ignorée puis purgée.';

-- Down Migration

DROP TABLE session;
