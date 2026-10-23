# Trame

Plateforme de suivi de lecture et de découverte pour la **création européenne, francophone d'abord** : manga, BD, webtoons et webcomics, d'auteurs indépendants (Mangadraft, auto-édition) comme d'éditeurs établis.

Pensée comme un « MyAnimeList » de cette scène : une fiche par œuvre, un suivi par chapitres lus et par tomes lus, une note sur 10, un profil public partageable.

**État** : MVP en développement. Catalogue, recherche, fiche œuvre, connexion Google, liste de lecture et profil public sont en place ; administration, soumissions et mise en ligne restent à faire.

## Démarrer

Prérequis : Node 24 (`.nvmrc`), Docker.

1. **Dépendances et hooks** : `npm ci` à la racine (installe les hooks lefthook), puis dans chaque dossier, depuis la racine :
   ```bash
   npm ci --prefix api
   npm ci --prefix web
   npm ci --prefix e2e
   ```
   `npm ci` installe exactement le `package-lock.json` ; dans `web/`, il lance aussi `nuxt prepare`, dont le lint typé a besoin.
2. **Configuration** : copier `.env.example` en `.env` (ignoré par git) et le remplir. `DATABASE_URL` est la base de travail, `TEST_DATABASE_URL` une base jetable pour les tests. La connexion Google est facultative en local.
3. **Base** : `docker compose up -d db`, puis dans `api/` : `npm run migrate:up` (base de travail) et `npm run migrate:test` (base de test). `npm run db:seed:bulk` ajoute à la base de travail des œuvres de démonstration fictives.
4. **Lancer** :
   - tout en conteneurs : `docker compose up -d --build`, site sur http://localhost:3001, API sur http://localhost:3000 ;
   - ou en développement, avec rechargement : `npm run dev` dans `api/`, et `npm run dev -- --port 3001` dans `web/`.

## Avant de pousser

Dans chaque dossier touché : `npm run typecheck`, `npm run lint` (ESLint avec les règles de SonarCloud), `npm run format:check`, `npm run test:coverage` ; les E2E nouveaux ou modifiés dans `e2e/` (`npm run test:desktop`, après `npm run build` dans `web/` et `npm run build:e2e` dans `api/`). Le hook de commit et la CI refont ces contrôles. Pièges que le quality gate refuse : [docs/conventions-projet.md](docs/conventions-projet.md) §6.

## Pour comprendre

| Sujet | Où |
|---|---|
| Vision, périmètre, objectifs | [docs/cadrage.md](docs/cadrage.md) |
| Spécifications fonctionnelles | [docs/specifications-fonctionnelles.md](docs/specifications-fonctionnelles.md) |
| Modèle de données | [docs/modele-de-donnees.md](docs/modele-de-donnees.md) |
| Architecture et décisions | [docs/architecture.md](docs/architecture.md) |
| Conventions (git, tests, qualité) | [docs/conventions-projet.md](docs/conventions-projet.md) |
| Commandes et règles par dossier | [api/CLAUDE.md](api/CLAUDE.md), [web/CLAUDE.md](web/CLAUDE.md) |
| Règles de travail (humain et assistant) | [CLAUDE.md](CLAUDE.md) |

Signaler une faille : voir [SECURITY.md](SECURITY.md).
