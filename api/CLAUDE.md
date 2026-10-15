# api/ — API Node/TypeScript

Express 5 + Kysely sur `pg`, Zod, node-pg-migrate (voir `docs/adr/0006-choix-techniques-api.md`). ESM, imports relatifs avec extension `.js`.

## Couches (`src/`)
`routes → controllers → services → repositories → base`, chaque couche ne connaît que celle du dessous.
- `routes/` : URL et validation d'entrée (`middleware/validate.ts`) ; montées sous `/api/v1` via `routes/index.ts`. `/health` reste hors préfixe.
- `controllers/` : lecture HTTP, appel du service, statut de réponse.
- `services/` : règles métier, sans HTTP ni SQL.
- `repositories/` : seule couche qui écrit du SQL (Kysely, toujours paramétré). Types de tables dans `db/database.ts`, ajoutés au besoin.
- Chaque brique est une fabrique (`createXxx(dépendance)`) ; `app.ts` assemble, `server.ts` démarre.

## Tests
Colocalisés comme côté web : `foo.ts` + `foo.test.ts` dans le même dossier de `src/` (`work.service.ts` ↔ `work.service.test.ts` avec un faux dépôt, `routes/work.routes.test.ts` pour le HTTP bout en bout sur la base de test). Les tests du schéma et du jeu de démo vivent dans `src/db/`. Le support commun (`src/testing/test-database.ts`) et les `*.test.ts` sont exclus du build (`tsconfig.build.json`), de la couverture (`vitest.config.ts`) et des sources Sonar. Pas de dossier `tests/` : n'y mettre aucun fichier ; ne jamais nommer un fichier de test dans `migrations/` (node-pg-migrate le lirait).

## Erreurs
Réponse unique `{ code, message, details? }` ; `message` est un texte technique en anglais, non affiché (le front lit `code`). `details[]` d'une validation : `path`, `code` Zod et paramètres, jamais de message ni de valeur saisie. Les codes vivent dans `src/errors.ts` (`ERROR_CODES`) : en ajouter un là, jamais de JSON d'erreur improvisé. Les erreurs inattendues donnent `INTERNAL_ERROR` sans détail.

## Commandes
- Les scripts npm et Vitest lisent le `.env` racine (variables déjà définies prioritaires, ex. en CI) : rien à exporter à la main.
- Deux bases, deux variables : `DATABASE_URL` = base de travail (serveur, `dev`, `migrate:up`, jamais vidée par un script) ; `TEST_DATABASE_URL` = base de test jetable (tests, `db:seed`, `migrate:test`), vidée et rechargée librement. Les tests n'ont aucun repli sur `DATABASE_URL`.
- `npm run dev` : serveur avec rechargement (`DATABASE_URL` requise).
- `npm run build` / `npm start` : compilation vers `dist/` puis exécution.
- `npm run typecheck`, `npm test` (`TEST_DATABASE_URL` requise, base migrée par `migrate:test`, tests en série).
- `npm run migrate:up` (base de travail), `npm run migrate:test` (base de test), `npm run db:seed` (démo dans la base de test).

## Règles
- Migration fusionnée dans `main` : on n'y touche plus, on en ajoute une.
- Tout changement de comportement ⇒ test ; toute évolution de schéma ⇒ migration + `docs/modele-de-donnees.md`.
