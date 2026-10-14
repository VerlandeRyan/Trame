# ADR 0008 — Choix techniques du front : Nuxt 4, SCSS et jetons maison, icônes Tabler embarquées

- **Statut** : accepté
- **Date** : 2026-10-14

## Contexte
Le squelette Nuxt (#18) fixe la base visuelle. Les maquettes ont une identité marquée (contours épais, ombres dures décalées, trame demi-teinte) et sont déjà écrites en CSS avec variables. Contraintes : rendu identique sur tous les appareils (Safari iOS compris), pas de dépendance externe au chargement, solo.

## Décision
- **Nuxt 4** en rendu serveur, `@nuxtjs/i18n` (français sans préfixe, autres langues en `/en/…`, repli sur le français, ADR 0007).
- **Pas de kit de composants** : SCSS maison, tous les styles lisent des **jetons CSS** (`web/app/assets/styles/_tokens.scss`) ; composants de base `Ui*` écrits à la main.
- **Icônes Tabler** en SVG embarqués par `@nuxt/icon` (aucun CDN, aucune police d'icônes).
- Primitives **headless** (accessibilité des modales complexes, combobox de recherche) ajoutées plus tard, au besoin ; `<dialog>` natif pour les modales simples.
- Pile de polices système tant que la police finale n'est pas choisie ; elle sera auto-hébergée.
- Qualité : `vue-tsc`, ESLint, E2E Playwright (bureau Chromium, WebKit iPhone).

## Alternatives écartées
Nuxt UI / PrimeVue / Vuetify (style imposé à contourner, dépendance forte) ; Tailwind (jetons déjà exprimés en variables CSS, peu de gain) ; police d'icônes ou CDN (rendu et vie privée).

## Conséquences
+ Rendu fidèle aux maquettes, aucune ressource tierce au chargement.
− Composants et accessibilité à écrire et tester nous-mêmes ; TypeScript 6 côté web tant que `vue-tsc` et typescript-eslint ne gèrent pas TypeScript 7.
