# Conventions de projet

> Statut : brouillon v0.1 — 2026-10-09

## 1. Dépôt
- **Un monorepo** public, sans fichier LICENSE pour l'instant : `api/`, `web/`, `db/`, `e2e/`, `docs/`, `.github/`.
- `private/` est ignoré par git (notes privées, données du catalogue, références de comptes). **Règle** : `docs/` contient ce dont un lecteur ou contributeur a besoin (spécifications, modèle, architecture, conventions) ; stratégie, analyse juridique, budgets et historique de réflexion restent dans `private/`.
- Structure cible :
```
trame/
├─ CLAUDE.md                 règles de travail (court)
├─ api/                      Node/TS + migrations/      (CLAUDE.md)
├─ web/                      Nuxt (+ Capacitor plus tard) (CLAUDE.md)
├─ db/demo-data.sql          jeu de démonstration FICTIF
├─ e2e/                      Playwright
├─ docs/                     documentation publique
├─ private/                  ignoré par git
├─ docker-compose.yml        base + api + web en local
└─ .github/workflows/        CI (plus tard)
```

## 2. Garde-fous du dépôt public (à poser avant le premier push)
1. Compte GitHub avec **2FA**.
2. **Secret scanning + push protection** activés.
3. **Protection de `main`** : PR obligatoire et CI verte.
4. `.gitignore` posé en premier (secrets, `private/`, données réelles, images, exports).
5. Aucune donnée réelle du catalogue, aucune image, aucun identifiant dans le dépôt.
6. `docs/` publiable sans regret (jamais d'identifiants, d'IP, d'URL d'administration, de noms de comptes, de clés, de détail exploitable de sécurité, ni d'information sur le poste ou l'environnement personnel du développeur).
7. **Pas de fichier LICENSE** pour l'instant.
8. `SECURITY.md` à jour.
9. Hooks locaux (section 4) + mêmes contrôles en CI.
10. Dépendances surveillées (Renovate ou Dependabot).
En cas d'erreur : **révoquer/changer le secret immédiatement** ; réécrire l'historique ne suffit pas une fois publié.

## 3. Git
- Branches : `feat/12-recherche`, `fix/…`, `docs/…`, `chore/…`, `refactor/…`, `hotfix/…` (numéro du ticket GitHub).
- Commits : `type(scope): message (#12)` — types `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.
- Une PR par ticket, `Closes #12`, fusion en squash.
- `main` est toujours déployable.

## 4. Hooks locaux (`lefthook`, fonctionnent sans GitHub)
- **pre-commit** : `gitleaks` (secrets), lint et format sur les fichiers modifiés.
- **commit-msg** : `commitlint` (format ci-dessus) et contrôle du préfixe de branche.
- **Avant toute ouverture du dépôt** : `gitleaks detect` sur l'historique complet.

## 5. Tickets
GitHub Issues + Projects. Labels `type:*` (feature, bug, docs, chore) et `area:*` (api, web, db, docs, infra). Le backlog vit dans GitHub Issues.

## 6. Qualité et tests
- Lint : ESLint + `eslint-plugin-vue` + Prettier ; types : `vue-tsc`, TypeScript strict (6, partout) ; SQL : SQLFluff.
- **Règles Sonar avant le push** : `npm run lint` (web, api, e2e) applique `eslint-plugin-sonarjs` en lint typé, comme le hook et la CI. Ce qu'un linter ne voit pas, et que le quality gate des PR refuse :
  - `void` seulement devant une vraie `Promise` : une fonction au type mixte (`navigateTo`) passe par une fonction `async` ;
  - pas de bloc recopié entre deux pages ou composants (≤ 3 % de duplication) : extraire un composable ;
  - chaque ligne nouvelle est testée (≥ 80 % du nouveau code) : lancer `npm run test:coverage` avant le push ;
  - pas de code commenté, CSS compris ; une exception de règle porte toujours sa raison en commentaire.
- Tests : Vitest (unitaires), tests d'API, Playwright (E2E, desktop + WebKit iPhone), Lighthouse CI et axe-core.
- **Tout changement de comportement ⇒ test E2E** ; toute évolution de schéma ⇒ migration + mise à jour du [modèle de données](modele-de-donnees.md).
- Localement : n'exécuter que les tests **nouveaux ou modifiés** ; la CI exécute la suite complète.
- Sécurité : Semgrep CE, OSV-Scanner/`npm audit`, CodeQL (public), SonarQube Cloud (public).

## 6 bis. Budget de documentation
La documentation doit rester petite pour rester juste et peu coûteuse à lire.
- **Un fait, un seul endroit** : valeurs énumérées (types, statuts, rôles) uniquement dans le [modèle de données](modele-de-donnees.md) ; comportements dans les [spécifications](specifications-fonctionnelles.md) ; choix techniques difficiles à défaire dans un ADR. Les autres documents renvoient au lieu de recopier.
- **Plafonds** : `CLAUDE.md` ≤ 150 lignes ; `private/etat-courant.md` ≤ 25 lignes ; un ADR ≤ 25 lignes ; tout autre document ≤ 250 lignes ; `docs/` ≤ 60 Ko au total.
- **Ajouter un document impose d'en fusionner ou d'en supprimer un.** Un backlog vit dans GitHub Issues, pas dans `docs/`.
- Un ADR n'est écrit que pour une décision difficile à défaire ; sinon la règle va dans les spécifications ou le modèle.

## 7. Definition of Done
- Code et tests écrits et verts ; lint et types verts.
- Documentation concernée mise à jour (spécifications, modèle, ADR si décision structurante).
- Aucun secret ni donnée réelle ; erreurs avec codes stables.
- Passation de session (`private/etat-courant.md`) mise à jour en fin de session seulement.

## 8. CI cible (GitHub Actions, quand il y aura du code)
Git Checks → lint + types + tests unitaires → tests d'API → build → E2E Playwright → Lighthouse. Déploiement à définir avec l'hébergement.

## 9. Technologies
Node LTS, TypeScript stable, aucune version préliminaire, versions épinglées, mises à jour par Renovate, une montée de version majeure à la fois.

## 10. Travail avec l'assistant
- `CLAUDE.md` court (≤ 150 lignes) ; chaque sous-dossier peut avoir le sien.
- Sessions légères : une session = un sujet ; prompt de démarrage ci-dessous ; passation dans `private/etat-courant.md` (hors dépôt).
- Modifications de fichiers via les outils d'édition (diffs visibles) ; modifications groupées puis une vérification.
- **Git sous le contrôle exclusif de Ryan** : l'assistant propose un message de commit (format de la section 3), Ryan exécute lui-même `add`, `commit` et `push`. L'assistant n'utilise git qu'en lecture.

### Prompt de démarrage d'une session
```text
Projet Trame (voir CLAUDE.md). Lis UNIQUEMENT CLAUDE.md puis private/etat-courant.md.
N'ouvre un autre document que si la tâche l'exige.

Tâche de cette session : <une phrase>.
Livrable attendu : <fichier(s) ou décision>.

Règles : modifie les fichiers avec Edit/Write (diffs visibles) ; regroupe tes
modifications puis fais UNE vérification ; reste sur la tâche, sans nettoyage annexe ;
si un point manque (licence, hébergement, périmètre MVP, droits), pose-moi une
question courte au lieu de supposer ; aucun secret, aucun fichier private/ ou .env ;
aucune commande git qui écrit (je commite moi-même).

Fin de session (seulement si je te le demande) : réécris private/etat-courant.md (fait / reste / décisions /
questions ouvertes), propose un message de commit, puis résume en 5 lignes.
```
Bonnes pratiques : un sujet par session ; demander « mets à jour etat-courant.md » une seule fois, avant de fermer ; « lis ce fichier » plutôt que « rappelle-toi » ; pas de sous-agents sauf besoin ; un changement de décision structurant = un ADR, pas seulement une phrase en conversation.
