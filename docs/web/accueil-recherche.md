# Web — Accueil, recherche, Explorer, 404

Comportement côté front (Nuxt) des écrans `/`, `/search` et de la page d'erreur. Le « quoi » fonctionnel est dans les [spécifications](../specifications-fonctionnelles.md) (US-01, US-15). Règles de conception générales (survol, zones de clic, animations) : [conventions §12](../conventions-projet.md). Composants : [composants.md](composants.md).

## Recherche (#21, maquettes 03/04, US-01)
- `layout/SearchBox` : combobox ARIA (suggestions dès 2 caractères après 200 ms, 3 lignes + « Voir les N résultats », flèches/Entrée/Échap, clic extérieur ; une erreur d'API ferme le menu sans message) dans l'en-tête, la 404 et la page `/search`.
- Au mobile, l'en-tête n'affiche qu'une icône qui **déploie le champ dans l'en-tête** (logo, langue et compte s'effacent, croix pour fermer, Échap ou changement de page aussi) : la page courante reste dessous et le menu s'y pose ; l'icône est masquée sur `/search`, qui porte son propre champ.

### Page `/search` (`pages/search.vue`)
- L'**URL est la source de vérité** (`q`, `type`, `format`, `genre`, `status`, `originalLanguage`, `page`) ; valeurs invalides ignorées (`parseSearchQuery`), **plusieurs valeurs par groupe** (liste séparée par des virgules dans l'URL ; OU dans un groupe sauf les genres en ET, ET entre groupes), changer un filtre revient à la page 1.
- Deux appels : `GET /works` (liste) et `GET /works/facets` (compteurs, hors `lang` et `page`).
- `search/Filters` (état ouvert/fermé par groupe, lien « Tout replier / Tout déplier ») + `search/FilterGroup` (bouton à chevron à gauche, pastille du nombre de choix, groupe masqué s'il n'a aucune valeur ; Type, Format, Genre dépliés).
- Feuille basse `UiModal placement="bottom"` au mobile (maquette 04 : pied « Réinitialiser » + « Voir N résultats », `Filters sheet`).
- `ui/Pagination` par liens, `search/ResultItem`.
- Tri par `ui/Select` (menu stylé, texte « Trier par Pertinence ▾ » ; `relevance`, `title`, `recent`) : `sort` dans l'URL seulement s'il diffère de la pertinence, envoyé à la liste mais jamais aux compteurs ; le menu de suggestions se rouvre au clic ou au focus du champ.
- Page en `noindex`.
- Le bouton « Ajouter » des résultats et « Proposer cette œuvre » (US-09) sont visibles mais inactifs : l'ajout depuis la recherche reste à faire (#190 ; la fiche œuvre porte déjà `library/EntryCard`).
- Logique pure dans `utils/search.ts`.

## Explorer (#97)
`layout/ExploreMenu` : bouton « Explorer ▾ » de l'en-tête (☰ au mobile, fenêtre pleine largeur sous l'en-tête) listant formats et genres avec compteurs (`GET /works/facets`, chargé à la première ouverture, ordre éditorial `pickExploreFacets`) et « Voir tout le catalogue ». `v-model:open` : `Header` le referme à l'ouverture de la recherche (jamais deux croix). Absent de `/search`. Le bloc Explorer n'est plus sur l'accueil ; `home/Explore` reste dans la galerie `/components`.

## Accueil (#79, maquettes 05/06, US-15)
`pages/home.vue` charge en parallèle `GET /works/featured`, `/works?sort=recent&pageSize=12` et `/works/top-rated` ; **un bloc vide ou dont l'appel échoue est masqué** (`optional()`), jamais d'erreur affichée. La page d'accueil est `pages/home.vue` (`path: '/'`).

### Hero visiteur (#95, accueil v2)
- Bande sur fond bleu pâle `--color-field-soft` (seule bande teintée, le reste reste sur le papier).
- À gauche : titre en Poppins 800 (`--font-display`, `@fontsource/poppins/latin-800.css`, auto-hébergée), tampons de formats inclinés (décor `aria-hidden`, une seule ligne jusqu'à 320 px : corps `min(0.78rem, 2.9vw)`), sous-titre à mots clés surlignés (`i18n-t`, `<mark>`), recherche.
- À droite : `home/Pitch` (« Pourquoi Trame ? » : 3 engagements, bouton « Créer ma liste de lecture » qui ouvre la fenêtre de connexion ; sous la recherche au mobile).

### Accueil connecté (#96, maquettes finales 3 à 6 d'`accueil-v2`)
- Un membre (`useAuth` `authenticated`, lu au rendu serveur : pas de clignotement ; `pending` garde l'accueil visiteur) n'a ni panneau, ni tampons, ni sous-titre à mots clés.
- Hero « Bon retour, @pseudo » + « Où en es-tu dans tes lectures ? » + recherche + bande `home/ContinueReading` (« Reprendre la lecture » : `GET /me/entries?status=reading&sort=updated&pageSize=3`, cartes couverture/titre/« Format · Chapitre N »/pastille de statut, bouton **+1** de 44 px, lien « Voir ma liste ›»).
- Le +1 compte un chapitre (un tome pour une œuvre suivie par tomes, `incrementUnit`), passe par `useContinueReading` (file `useRequestQueue`, `PUT /works/:id/entry`, affichage immédiat, retour à l'état d'avant en cas d'échec) et par `useReadingPrompt` : atteindre le total connu demande « Tu as fini cette œuvre ? » ; une œuvre qui n'est plus « En cours » quitte la bande, sans être remplacée.
- **Liste vide** (aucune œuvre, tous statuts : somme de `statusCounts`) : hero centré « Bienvenue sur Trame, @pseudo », « Ta liste est vide… », recherche, « Ou pars d'un format » et formats cliquables vers `/search?format=`.
- Une panne de `/me/entries` masque la bande (`null`) sans jamais afficher « liste vide » ; rien en cours mais une liste non vide : « Bon retour » sans bande.
- La clé `useAsyncData` de la page contient l'état membre/visiteur. Tests de page : `enableAutoUnmount`, sinon une page restée montée relit ses données quand la connexion change.

### Blocs
- Icônes du panneau aux couleurs de l'app : vert « En cours » (suivi), lavande « À lire » (tout au même endroit), jaune de « À la une » (découverte). Jetons `--color-yellow`, `--color-cyan`, `--color-crimson` (contrastes dans `contrast.spec.ts`).
- `home/Featured` : carrousel sans défilement automatique (précédent/suivant, pastilles ; badge jaune doré). Badge « Populaire cette semaine » et ligne des lecteurs si `isPopular`, sinon badge « À découvrir » sans ligne des lecteurs.
- `home/Shelf` : rangée sur une seule ligne, 12 œuvres demandées, autant affichées que la largeur le permet, chacune d'au moins 136 px / 104 px au mobile, qui se partagent toute la largeur ; « Tout voir » facultatif, absent pour « Mieux notées » faute de tri par note.
- « Une œuvre manque » (bouton inactif, US-09).
- L'accueil porte son propre champ de recherche (`LayoutSearchBox` + bouton « Rechercher » au bureau) : **l'en-tête n'en a pas sur `/`** (`layout-header--plain`).
- Logique pure et types dans `utils/home.ts`.

### Dimensions et écarts assumés
- Dimensions relevées dans le HTML des maquettes 05/06 : bande « hero » pleine largeur fermée par un filet ; blocs séparés de 26 px ; rangées d'œuvres de 136 px au moins (104 px au mobile) étirées sur toute la largeur, une seule ligne, les œuvres qui ne tiennent pas sont masquées ; ordre éditorial des formats et genres dans `exploreCodes`.
- Écarts assumés : cadres de `--border` (3 px) au lieu de 2 px ; boutons à 44 px (`UiButton`, comme le reste du site) ; pastilles d'Explorer, flèches et pastilles du carrousel à la taille de la maquette avec une **zone tactile de 44 px invisible** (`::after`).
- Les marges de `<main>` sont des variables (`--main-pad-*`) que l'accueil annule pour ses bandes.
- Les chips d'Explorer penchent de 1,2° (les boutons de 2,5° : une pastille large dévie plus pour un même angle) et s'étirent pour que chaque rangée occupe toute la largeur.

### Animations et geste
- Toutes dans `@media (prefers-reduced-motion: no-preference)` : le carrousel passe par un `<Transition mode="out-in">` dont le sens (variable `--slide-shift`, ±24 px) suit le clic (suivant, précédent, pastille) ; rien n'apparaît en fondu à l'arrivée sur la page (cela fausserait le contraste mesuré par axe-core).
- Pas de défilement automatique, mais le carrousel se **fait glisser au doigt** (`pointerdown`/`pointerup` de `featured__stage`, `touch-action: pan-y`, `swipeStep` dans `utils/home.ts` : seuil de 40 px, geste plutôt horizontal ; la souris est ignorée).
- Au doigt, flèches, pastilles et chips prennent leur couleur de survol à l'appui (`:active`).

## Page 404 (`app/error.vue`, maquettes 24/25)
Grand « 404 », titre, même texte d'aide au bureau et au mobile, champ de recherche (`LayoutSearchBox`), bouton « Retour à l'accueil ». Les autres erreurs gardent `UiEmptyState`. La « fiche archivée » (maquette 24, état 6) attend un code d'erreur API dédié.

## Trame du bord droit
- Sur l'accueil (`definePageMeta({ trame: 'hero' })`), elle vit seulement dans la bande du hero (`.home__hero::before`, même motif, coupée au filet, opacité 0,4 : il n'y a pas de texte courant dessous).
- Partout ailleurs `layouts/default.vue` pose une colonne de points roses (`--color-trame-side` = `--color-rose-vivid`, comme les couvertures sans image ; 24 % de la largeur au mobile, 30 % dès 768 px), `position: fixed` derrière `<main>` (`z-index` 0/1), qui s'estompe vers la gauche et vers le bas.
- Décor pur : `aria-hidden`, `pointer-events: none`, opacité 0,23 (à 0,4 les points gênaient la lecture du tri et des titres) ; `e2e/tests/layout.spec.ts` vérifie qu'elle est présente, au bord droit et qu'elle ne capte aucun clic. Les marges de `<main>` annulées par l'accueil ne la concernent pas.
- Mixin `screentone` (`app/assets/styles/_mixins.scss`).
