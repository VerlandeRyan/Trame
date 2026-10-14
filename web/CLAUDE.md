# web/ — Front Nuxt

Nuxt 4 (SSR) + `@nuxtjs/i18n` + `@nuxt/icon` + SCSS maison (voir `docs/adr/0008-choix-techniques-web.md`). Code applicatif sous `app/`, langues sous `i18n/locales/`.

## Règles
- **Jetons d'abord** : couleurs, ombres, espacements viennent de `app/assets/styles/_tokens.scss` (variables CSS). Jamais de valeur de couleur en dur dans un composant.
- **Textes en clés** : aucun texte en dur dans les templates ; `t('section.clé')`. Le français est la référence (`fr.json`) ; les autres langues retombent dessus.
- **Erreurs d'API** : le front lit `code` et affiche `t('error.<CODE>')`, jamais `message`.
- **Énumérations** : codes anglais de l'API (`reading`, `plan_to_read`, `series`…), libellés dans les fichiers de langue.
- **Composants** : un sous-dossier de `app/components/` = un préfixe de nom (`ui/Button.vue` → `<UiButton>`). Réutiliser avant d'en créer ; la page `/components` les présente. Fichiers, routes et dossiers en anglais, textes affichés en clés i18n.
  - `ui/` génériques : `Button`, `Chip`, `Counter` (− / saisie / +), `EmptyState`, `Field`, `Modal`, `Panel` (bloc blanc à ombre), `Rule` (frise), `Tabs`.
  - `work/` œuvres : `Card` (fiche résumée : couverture, titre, type), `Cover` (avec/sans image, `small`).
- **Galerie `/components`** : 404 en production (`NODE_ENV=production`), sauf `NUXT_PUBLIC_COMPONENT_GALLERY=true` (les E2E et docker-compose l'activent) ; indicateur unique `runtimeConfig.public.componentGallery`. La page d'accueil est `pages/home.vue` (`path: '/'`).
  - `layout/` structure du site : `Header`, `LanguageSwitcher`.
- **Layouts** (`app/layouts/`) : convention Nuxt, ce sont les coquilles qui entourent les pages. `default.vue` s'applique à toutes les pages (lien d'évitement, en-tête, zone de contenu `<slot />`) ; un autre layout (ex. connexion sans en-tête) se choisit par page avec `definePageMeta({ layout })`.
- **Tests** : colocalisés avec le code (`foo.ts` + `foo.spec.ts`), comme `hortibat_frontend`. Vitest (environnement Nuxt, `mountSuspended`) : tout fichier `.vue` (composant, page, layout, `app.vue`, `error.vue`) a son `.spec.ts` voisin ; la logique pure vit dans `utils/` (testée sans Nuxt) et `composables/` ne fait que la brancher sur Nuxt. Seuil de couverture : 80 % (lignes, instructions, fonctions, branches), analyse Sonar de `web/` (projet `VerlandeRyan_Trame_web`, `sonar-project.properties`). Les parcours sont dans les E2E, avec un contrôle automatique d'accessibilité axe-core (WCAG 2 A/AA) sur chaque page. Le cache disque de Vitest (`fsModuleCache`) est désactivé : avec l'environnement Nuxt il fait échouer les exécutions suivantes. Ne pas utiliser `mockNuxtImport` (casse la résolution des imports de l'environnement Nuxt sous Windows) : injecter les dépendances, comme `createApiClient`.
- **Trame** : mixin `screentone` (`app/assets/styles/_mixins.scss`).
- **Appels API** : `useApi().request()` (erreurs normalisées par `toApiError`), message affiché via `messageKeyFor(error)` ; logique pure dans `app/utils/api-error.ts` (testée).
- **Pas de pied de page** tant qu'il n'est pas maquetté ; à définir en temps voulu (mentions légales : #35).
- **Lisibilité** : noms explicites (pas d'abréviations d'une lettre), classes BEM par composant (`counter__button`), pas de ternaires imbriqués, un fichier = une responsabilité.
- **Contraste AA** (mesuré le 2026-10-14) : encre `#1b2a5c` sur les cinq couleurs de statut ≥ 4,59:1, sur le rose 5,20:1 ; blanc sur bleu 8,41:1. Ne jamais mettre de texte blanc sur une couleur de statut (1,45 à 2,98:1).
- **Icônes** : `<Icon name="tabler:…" />` uniquement ; aucune police d'icônes ni CDN.
- **Appareils** : zones tactiles ≥ 44 px (`--touch`), champs à 16 px minimum (Safari iOS), pas de défilement horizontal, `100dvh` plutôt que `100vh` seul. Points de rupture : 768 et 1024 px.
- Pas de `v-html` sur du contenu utilisateur ; données de démo fictives uniquement.
- URL : français sans préfixe, autres langues en `/en/…` ; liens via `useLocalePath()`.

## Commandes
- `npm run dev` : serveur de développement (API attendue sur `NUXT_API_BASE`, `http://localhost:3000` par défaut).
- `npm run typecheck` (`vue-tsc`), `npm run lint` (ESLint, règles renforcées comme `hortibat_frontend`), `npm run format` / `format:check` (Prettier : sans point-virgule, guillemets simples, 100 colonnes), `npm test` / `npm run test:coverage` (Vitest, logique pure, couverture lcov), `npm run build` puis `npm run preview`.
- E2E : `e2e/` ; construire `web/` d'abord, puis `npm test` dans `e2e/` (localement, `npm run test:desktop` suffit ; la CI exécute aussi WebKit iPhone).
- TypeScript 6 ici (vue-tsc et typescript-eslint ne gèrent pas encore TypeScript 7, utilisé par `api/`).
