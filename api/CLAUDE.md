# api/ — API Node/TypeScript

Express 5 + Kysely sur `pg`, Zod, node-pg-migrate (voir `docs/adr/0006-choix-techniques-api.md`). ESM, imports relatifs avec extension `.js`.

## Couches (`src/`)
`routes → controllers → services → repositories → base`, chaque couche ne connaît que celle du dessous.
- `routes/` : URL et validation d'entrée (`middleware/validate.ts`) ; montées sous `/api/v1` via `routes/index.ts`. `/health` reste hors préfixe.
- `controllers/` : lecture HTTP, appel du service, statut de réponse.
- `services/` : règles métier, sans HTTP ni SQL.
- `repositories/` : seule couche qui écrit du SQL (Kysely, toujours paramétré). Types de tables dans `db/database.ts`, ajoutés au besoin.
- Chaque brique est une fabrique (`createXxx(dépendance)`) ; `app.ts` assemble, `server.ts` démarre.

## Erreurs
Réponse unique `{ code, message, details? }`. Les codes vivent dans `src/errors.ts` (`ERROR_CODES`) : en ajouter un là, jamais de JSON d'erreur improvisé. Les erreurs inattendues donnent `INTERNAL_ERROR` sans détail.

## Commandes
- `npm run dev` : serveur avec rechargement (`DATABASE_URL` requise).
- `npm run build` / `npm start` : compilation vers `dist/` puis exécution.
- `npm run typecheck`, `npm test` (base migrée requise, tests en série).
- `npm run migrate:up`, `npm run db:seed`.

## Règles
- Migration fusionnée dans `main` : on n'y touche plus, on en ajoute une.
- Tout changement de comportement ⇒ test ; toute évolution de schéma ⇒ migration + `docs/modele-de-donnees.md`.
