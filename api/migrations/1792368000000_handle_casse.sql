-- Up Migration

-- Le handle garde la casse saisie (« Ryan ») ; l'unicité reste insensible à la casse (citext).
ALTER TABLE app_user
  DROP CONSTRAINT app_user_handle_format_check,
  DROP CONSTRAINT app_user_handle_reserved_check;

ALTER TABLE app_user
  ADD CONSTRAINT app_user_handle_format_check CHECK (handle::text ~ '^[A-Za-z0-9_-]{3,30}$'),
  ADD CONSTRAINT app_user_handle_reserved_check CHECK (lower(handle::text) NOT IN (
    'admin', 'administrator', 'administrateur', 'moderator', 'moderateur', 'equipe', 'staff',
    'support', 'contact', 'aide', 'help', 'system', 'anonyme', 'root', 'trame', 'api', 'oeuvre'
  ));

COMMENT ON COLUMN app_user.handle IS 'Identifiant public unique, insensible à la casse pour l''unicité ; la casse saisie est conservée pour l''affichage.';

-- Down Migration

ALTER TABLE app_user
  DROP CONSTRAINT app_user_handle_format_check,
  DROP CONSTRAINT app_user_handle_reserved_check;

UPDATE app_user SET handle = lower(handle::text);

ALTER TABLE app_user
  ADD CONSTRAINT app_user_handle_format_check CHECK (handle::text ~ '^[a-z0-9_-]{3,30}$'),
  ADD CONSTRAINT app_user_handle_reserved_check CHECK (handle::text NOT IN (
    'admin', 'administrator', 'administrateur', 'moderator', 'moderateur', 'equipe', 'staff',
    'support', 'contact', 'aide', 'help', 'system', 'anonyme', 'root', 'trame', 'api', 'oeuvre'
  ));

COMMENT ON COLUMN app_user.handle IS 'Identifiant public unique, insensible à la casse.';
