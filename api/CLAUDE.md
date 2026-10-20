# api/ — API Node/TypeScript

Express 5 + Kysely sur `pg`, Zod, node-pg-migrate (voir `docs/adr/0006-choix-techniques-api.md`). ESM, imports relatifs avec extension `.js`.

## Couches (`src/`)
`routes → controllers → services → repositories → base`, chaque couche ne connaît que celle du dessous.
- `routes/` : URL et validation d'entrée (`middleware/validate.ts`) ; montées sous `/api/v1` via `routes/index.ts`. `/health` reste hors préfixe.
- `controllers/` : lecture HTTP, appel du service, statut de réponse.
- `services/` : règles métier, sans HTTP ni SQL.
- `repositories/` : seule couche qui écrit du SQL (Kysely, toujours paramétré). Types de tables dans `db/database.ts`, ajoutés au besoin.
- Chaque brique est une fabrique (`createXxx(dépendance)`) ; `app.ts` assemble, `bootstrap.ts` démarre (écoute, purge des sessions, arrêt) et `server.ts` en est le point d'entrée réel. `server.e2e.ts` (E2E seulement) démarre la même API avec `e2e/fake-google.ts` à la place de Google ; il est exclu du build de production (`tsconfig.build.json`) et compilé à part par `npm run build:e2e` dans `dist-e2e/`, qui n'entre pas dans l'image Docker.

## Tests
Colocalisés comme côté web : `foo.ts` + `foo.test.ts` dans le même dossier de `src/` (`work.service.ts` ↔ `work.service.test.ts` avec un faux dépôt, `routes/work.routes.test.ts` pour le HTTP bout en bout sur la base de test). Les tests du schéma et du jeu de démo vivent dans `src/db/`. Le support commun (`src/testing/test-database.ts`) et les `*.test.ts` sont exclus du build (`tsconfig.build.json`), de la couverture (`vitest.config.ts`) et des sources Sonar. Pas de dossier `tests/` : n'y mettre aucun fichier ; ne jamais nommer un fichier de test dans `migrations/` (node-pg-migrate le lirait).

## Recherche du catalogue (`GET /works`, `GET /works/facets`)
Contrat complet : `docs/architecture.md`. À retenir en lisant le code :
- `src/search-terms.ts` découpe `q` en mots (6 au plus, sans doublon). `termCondition` (dépôt) cherche un mot dans le titre, les titres alternatifs, les auteurs, les éditeurs et les codes de format/genre ; `searchCondition` les combine en **ET** (mode `all`, défaut) ou **OU** (mode `any`).
- Le **service** décide du repli : si aucune œuvre ne contient tous les mots (au moins deux), il relance en `any` et marque la réponse `approximate: true`. Les compteurs ne décident pas : le front passe `match=any` à `/works/facets` quand la liste est approchante.
- **Filtres multi-valeurs** : `type`, `status`, `format`, `genre`, `originalLanguage` acceptent une liste séparée par des virgules (`commaSeparatedList` dans `routes/work.routes.ts`, 10 valeurs au plus, doublons ignorés). Valeurs d'un filtre : OU, **sauf `genre` : ET** (une condition par genre choisi) ; filtres entre eux : ET.
- **Compteurs** (`facets` du dépôt) : un groupe applique la recherche et tous les autres filtres, pas le sien ; le groupe `genre` (ET) garde le sien, pour que le compteur d'une valeur soit ce que donnerait son ajout. Pas de `sort`, de `lang` ni de pagination.
- **Tri** `sort` : `relevance` (défaut ; titre si pas de `q`), `title`, `recent` (`work.created_at`). Toujours terminé par le titre puis l'`id`, pour une pagination stable.
- Ne jamais interpoler une valeur de la requête dans le SQL : paramètres Kysely (`sql.join`), seul `sql.ref` reçoit des constantes écrites dans le code.

## Accueil (`GET /works/featured`, `GET /works/top-rated`)
- Seuils et tailles dans `services/work.service.ts` (`FEATURED_*`, `TOP_RATED_LIMIT`, `MIN_RATINGS_FOR_AVERAGE`), passés au dépôt en paramètres : le dépôt ne connaît pas les règles. Le dépôt joint un sous-ensemble agrégé de `library_entry` (ajouts récents, notes) à `work` ; la moyenne est calculée dans le service.
- `library_entry.created_at` (migration `…_library_entry_created_at`) date l'ajout ; `updated_at` bouge à chaque progression. Le jeu de démo (`db/demo-data.sql`) pose des ajouts relatifs à `now()` pour que « 7 jours » reste vrai à chaque rechargement ; les tests de ces routes en dépendent.

## Liste de lecture (`/works/:id/entry`)
Contrat : `docs/architecture.md`. Tables `library_entry` et `reading_event` (migration `…_utilisateurs`) ; aucune migration propre à #23.
- `library.service.ts` porte les règles : fusion des champs omis, dates proposées au changement de statut, et `journalEvents` (une ligne de journal par statut, compteur ou note modifié ; variation **signée** pour que les sommes du bilan annuel restent justes ; retirer une note n'écrit rien).
- `library.repository.ts` `save(userId, workId, decide)` lit l'entrée avec `FOR UPDATE`, appelle `decide` puis écrit entrée et journal dans **une transaction** : deux requêtes qui se croisent ne faussent pas le journal. Le service n'écrit pas de SQL, le dépôt ne connaît pas les règles.
- Routes protégées par `requireUser` ; limite d'écriture `LIBRARY_RATE_LIMIT` (120/min/IP, un `+1` répété ne doit pas être gêné). Le routeur est monté sous `/works` **avant** `createWorkRouter`.
- Tests : `routes/library.routes.test.ts` supprime ses propres utilisateurs (e-mail `@library.test`) au lieu de tronquer `app_user`, dont dépend `work` (`deleted_by`).

## Authentification (`/auth`)
Contrat : `docs/architecture.md`. À retenir en lisant le code :
- Les routes ne lisent jamais `req.session` : seul `middleware/auth.ts` (`attachUser`) le fait et pose `req.user` ; on protège une route avec `requireUser` / `requireAdmin`. Un `Authorization: Bearer` (Capacitor/Expo) pourra s'ajouter dans `attachUser` sans toucher aux routes.
- `services/google-identity.ts` est la seule porte vers Google (doublure `GoogleClient` dans les tests, aucun appel réseau). Sans client OAuth configuré, `AUTH_UNAVAILABLE`.
- Le compte n'est créé qu'au choix du handle (`POST /auth/handle`) ; avant, l'identité attend 10 minutes dans la session. On ne conserve que `google_sub` et l'e-mail (pas le nom Google), jamais renvoyés par l'API.
- Les redirections vers le front gardent la langue de `returnTo` : `localePrefix` ajoute `/en` (langues de `SUPPORTED_LANGUAGES` hors français) devant `/signup/handle` et `/?auth_error=`.
- `session/store.ts` : store `express-session` maison sur la table `session` (SQL dans `repositories/session.repository.ts`) ; `bootstrap.ts` purge les sessions expirées.
- Handle : casse conservée, unicité insensible à la casse (citext). Mots réservés et offensants dans `handle-rules.ts` (code, pas de migration) : `OFFENSIVE_ANYWHERE` (mot refusé où qu'il soit) et `OFFENSIVE_WHOLE` (segment entier seulement, pour ne pas toucher Monique, Dickens, Nazir…).
- Derrière un reverse proxy HTTPS, `TRUST_PROXY` (nombre de proxys) est indispensable : sans lui Express croit être en HTTP et le cookie `Secure` n'est jamais posé. En production `SESSION_SECRET` est obligatoire ; les E2E (HTTP local) passent `SECURE_COOKIES=false`.
- **Jamais d'écriture en `GET`** : le cookie `SameSite=Lax` est envoyé sur un lien venu d'un autre site, et l'anti-CSRF (`checkOrigin`) ne contrôle pas les lectures. Toute écriture passe par `POST`, `PUT`, `PATCH` ou `DELETE`.
- Limite de débit : `middleware/rate-limit.ts` donne `AUTH_RATE_LIMIT` et les options communes (mémoire du processus) ; `routes/auth.routes.ts` appelle lui-même `rateLimit(...)` (CodeQL ne reconnaît le limiteur que créé dans le fichier de la route). `createApp` accepte `auth.rateLimit` pour que les tests la relèvent. Le relais Nuxt transmet l'adresse du visiteur (`X-Forwarded-For`, `forwardedFor` dans `web/shared/utils/api-relay.ts`) : `TRUST_PROXY` = nombre de proxys entre le visiteur et l'API, le site Nuxt compris (1 par défaut dans `docker-compose.yml`). Recherche et soumission ne sont pas encore limitées (#85).
- `npm run db:promote-admin -- <handle>` : promeut le premier admin (base de travail, `DATABASE_URL`) ; refuse dès qu'un admin existe. Testé dans `src/db/promote-admin.test.ts`.

## Erreurs
Réponse unique `{ code, message, details? }` ; `message` est un texte technique en anglais, non affiché (le front lit `code`). `details[]` d'une validation : `path`, `code` Zod et paramètres, jamais de message ni de valeur saisie. Les codes vivent dans `src/errors.ts` (`ERROR_CODES`) : en ajouter un là, jamais de JSON d'erreur improvisé. Les erreurs inattendues donnent `INTERNAL_ERROR` sans détail.

## Documentation OpenAPI (`src/openapi/`)
- `document.ts` construit le document (`GET /api/v1/openapi.json`) : paramètres tirés des schémas Zod de `routes/` (`describe` = texte de la doc), réponses décrites dans `schemas.ts` (liés aux types des services par `satisfies`, `strictObject`).
- **Nouvelle route ⇒ nouveau chemin dans `document.ts` + schéma de réponse** ; `openapi.test.ts` échoue si une route montée n'est pas documentée (ou l'inverse) ou si une réponse s'écarte de son schéma.
- `/docs` (Scalar, chargé par import dynamique) n'est monté que si `server.ts` fournit `docs`, c'est-à-dire hors `NODE_ENV=production`. L'image Docker est en production ; `docker-compose.yml` (développement local) force `NODE_ENV: development` pour l'activer.

## Commandes
- Les scripts npm et Vitest lisent le `.env` racine (variables déjà définies prioritaires, ex. en CI) : rien à exporter à la main.
- Deux bases, deux variables : `DATABASE_URL` = base de travail (serveur, `dev`, `migrate:up`, jamais vidée par un script) ; `TEST_DATABASE_URL` = base de test jetable (tests, `db:seed`, `migrate:test`), vidée et rechargée librement. Les tests n'ont aucun repli sur `DATABASE_URL`.
- `npm run dev` : serveur avec rechargement (`DATABASE_URL` requise).
- `npm run build` / `npm start` : compilation vers `dist/` puis exécution.
- `npm run typecheck`, `npm test` (`TEST_DATABASE_URL` requise, base migrée par `migrate:test`, tests en série).
- `npm run migrate:up` (base de travail), `npm run migrate:test` (base de test), `npm run db:seed` (démo dans la base de test).
- `npm run db:seed:bulk` / `db:seed:bulk:remove` : 48 œuvres fictives marquées « [Démo] » (+ personnes et éditeurs « (démo) », genres thématiques) **ajoutées** à la base de travail locale pour essayer pagination, genres et tri (`db/demo-bulk.sql`). Rien n'est vidé ; le retrait ne supprime que les lignes marquées.

## Règles
- Migration fusionnée dans `main` : on n'y touche plus, on en ajoute une.
- Tout changement de comportement ⇒ test ; toute évolution de schéma ⇒ migration + `docs/modele-de-donnees.md`.
