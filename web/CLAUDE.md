# web/ — Front Nuxt

Nuxt 4 (SSR) + `@nuxtjs/i18n` + `@nuxt/icon` + SCSS maison (voir `docs/adr/0008-choix-techniques-web.md`). Code applicatif sous `app/`, langues sous `i18n/locales/`.

Ce fichier ne garde que les **règles et les pièges** (≤ 10 Ko, `docs/conventions-projet.md` §6 bis). Le comportement de chaque écran et le catalogue des composants sont dans `docs/web/` ; avant de toucher un écran, lire son fichier.

## Où lire quoi
| Sujet | Fichier |
|---|---|
| Catalogue des composants (`ui/`, `work/`, `layout/`…), galerie `/components`, layouts | `docs/web/composants.md` |
| Fiche œuvre, fiche de lecture, confirmations « commencer / terminé » | `docs/web/fiche-oeuvre.md` |
| Ma liste de lecture, profil public | `docs/web/liste-et-profil.md` |
| Administration du catalogue | `docs/web/administration.md` |
| Accueil, recherche, Explorer, 404, trame du bord droit | `docs/web/accueil-recherche.md` |
| Connexion Google, choix du pseudo, avis, menu de compte | `docs/web/connexion-compte.md` |
| Jetons, survol, zones de clic, animations, contraste, appareils, icônes | `docs/conventions-projet.md` §12 |

## Règles
- **Jetons d'abord** : jamais de couleur, d'ombre ni d'épaisseur de contour en dur (`--border`) ; tout vient de `app/assets/styles/_tokens.scss` (détail : conventions §12).
- **Textes en clés** : aucun texte en dur dans les templates ; `t('section.clé')`. Le français est la référence (`fr.json`) ; les autres langues retombent dessus.
- **Erreurs d'API** : le front lit `code` et affiche `t('error.<CODE>')`, jamais `message`.
- **Énumérations** : codes anglais de l'API (`reading`, `plan_to_read`, `series`…), libellés dans les fichiers de langue.
- **Composants** : un sous-dossier de `app/components/` = un préfixe de nom (`ui/Button.vue` → `<UiButton>`). Réutiliser avant d'en créer ; la page `/components` les présente et `docs/web/composants.md` les liste. Fichiers, routes et dossiers en anglais, textes affichés en clés i18n.
- Pas de `v-html` sur du contenu utilisateur ; données de démo fictives uniquement.
- URL : français sans préfixe, autres langues en `/en/…` ; liens via `useLocalePath()`.
- Une écriture à effet immédiat (le résultat s'affiche avant la réponse) passe par `useOptimisticWrite` ; la question « commencer / reprendre / terminé » par `useReadingPrompt`.

## Pièges
- **Tests** : colocalisés avec le code (`foo.ts` + `foo.spec.ts`), comme `hortibat_frontend`. Vitest (environnement Nuxt, `mountSuspended`) : tout fichier `.vue` (composant, page, layout, `app.vue`, `error.vue`) a son `.spec.ts` voisin ; la logique pure vit dans `utils/` (testée sans Nuxt) et `composables/` ne fait que la brancher sur Nuxt. Seuil de couverture : 80 % (lignes, instructions, fonctions, branches), analyse Sonar de `web/` (projet `VerlandeRyan_Trame_web`, `sonar-project.properties`). Les parcours sont dans les E2E, avec un contrôle automatique d'accessibilité axe-core (WCAG 2 A/AA) sur chaque page. Le cache disque de Vitest (`fsModuleCache`) est désactivé : avec l'environnement Nuxt il fait échouer les exécutions suivantes. Ne pas utiliser `mockNuxtImport` (casse la résolution des imports de l'environnement Nuxt sous Windows) : injecter les dépendances, comme `createApiClient`.
- **Types de l'API** : jamais recopiés à la main. `app/contract/api-schema.ts` est **généré** par `npm run api:types` depuis `api/openapi.json` (lui-même produit par `npm run openapi:export` dans `api/`) : ne jamais l'éditer, le régénérer après tout changement de contrat (la CI lance `api:types:check` et échoue s'il diffère). `app/contract/api.ts` nomme les morceaux utiles (`WorkSummary`, `ListPage`, `Profile`…) ; les fichiers de `utils/` les ré-exportent pour garder leurs imports. Restent écrits à la main : les types **d'interface** (`SearchState`, `ListState`, `ReadingPrompt`…), `StatusCounts` (le contrat décrit un dictionnaire, l'API donne tous les statuts) et les tableaux d'exécution comme `LIBRARY_STATUSES` (`satisfies` + test de type contre le contrat). Le dossier est `contract/` et non `types/` : Nuxt scanne `types/` pour ses imports automatiques et signale des doublons. `openapi-typescript` n'a pas encore de version pour TypeScript 6 : `overrides` dans `package.json`.
- **Appels API** : `useApi().request()` (erreurs normalisées par `toApiError`, idempotent ; au rendu serveur, `useApi` ajoute lui-même le cookie du visiteur à chaque appel : ne pas le repasser dans `headers`), message affiché via `messageKeyFor(error)` ; logique pure dans `app/utils/api-error.ts` (testée). Le SSR appelle l'API directement (`NUXT_API_BASE`) ; le navigateur appelle `/api/v1/…` sur le même site, relayé par `server/api/v1/[...path].ts` : lectures partout, écritures seulement `POST` sous `/auth`, `PUT`/`DELETE` sur `works/{id}/entry` et celles de `admin/{people|publishers|works}` (règles dans `shared/utils/api-relay.ts`, auto-importé côté serveur ; une route d'écriture s'ajoute avec son ticket) ; redirections (`redirect: 'manual'`) et `Set-Cookie` sont relayés tels quels, et l'adresse du visiteur est ajoutée à `X-Forwarded-For` (sinon les limites de débit de l'API seraient partagées par tous : `TRUST_PROXY` côté API). `useApi` lit `useNuxtApp().$i18n` (pas `useI18n()`) pour servir aussi dans un plugin.
- **En-têtes de sécurité** : `routeRules` de `nuxt.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) sur toutes les réponses, relais compris ; testés par `e2e/tests/security-headers.spec.ts`. Pas de CSP encore (nonce à étudier). Le cookie de session s'appelle `__Host-trame.sid` en production, `trame.sid` en HTTP local : `hasSessionCookie` reconnaît les deux.
- **Pièges propres à un écran** (E2E sur des œuvres précises, confirmations qui partagent des `data-testid`, `clearNuxtData` dans les tests de page…) : dans le fichier `docs/web/` de l'écran, section « Tests ».

## Commandes
- `npm run dev` : serveur de développement (API attendue sur `NUXT_API_BASE`, `http://localhost:3000` par défaut).
- `npm run typecheck` (`vue-tsc`), `npm run lint` (ESLint, règles renforcées comme `hortibat_frontend`), `npm run format` / `format:check` (Prettier : sans point-virgule, guillemets simples, 100 colonnes), `npm test` / `npm run test:coverage` (Vitest, logique pure, couverture lcov), `npm run build` puis `npm run preview`.
- E2E : `e2e/` ; construire `web/` d'abord, puis `npm test` dans `e2e/` (localement, `npm run test:desktop` suffit ; la CI exécute aussi WebKit iPhone). Les E2E lisent la **vraie API** (`api/dist-e2e/server.e2e.js`, donc `npm run build:e2e` dans `api/` aussi) sur la base de test (`TEST_DATABASE_URL`, migrée par `npm run migrate:test`) : `e2e/support/global-setup.ts` y recharge `db/demo-data.sql` avant chaque exécution. Les parcours s'écrivent donc sur les données de démo (ex. `q=basalte`, fiche `/work/1-les-lanternes-de-brume`) ; changer le jeu de démo peut casser un E2E comme un test de l'API. Il n'y a plus de doublure d'API. **Seul Google est remplacé** : `playwright.config.ts` lance `api/dist-e2e/server.e2e.js` (fausse identité, limite de débit relevée, refuse de démarrer si un client Google est configuré ; absent du build de production et de l'image Docker), et `e2e/tests/auth.spec.ts` rejoue le trajet réel (callback, session, cookie, relais). La connexion avec un vrai Google se vérifie à la main.
- TypeScript 6 partout (vue-tsc et typescript-eslint ne gèrent pas encore TypeScript 7 ; Renovate ne le propose pas). `npm run lint` applique aussi `eslint-plugin-sonarjs` en lint typé (pièges Sonar : `docs/conventions-projet.md` §6).
