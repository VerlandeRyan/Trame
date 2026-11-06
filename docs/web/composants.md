# Web — Catalogue des composants

Un sous-dossier de `app/components/` = un préfixe de nom (`ui/Button.vue` → `<UiButton>`). **Réutiliser avant d'en créer** ; la page `/components` (galerie) les présente. Un nouveau composant ajoute ici sa ligne (règle du `CLAUDE.md` racine), avec son `.spec.ts`, son entrée dans la galerie et ses clés i18n `fr` et `en`. Le comportement des écrans est dans les autres fichiers de [docs/web/](.) ; les règles de conception (survol, zones de clic, contraste) dans [conventions §12](../conventions-projet.md).

## `ui/` — génériques
- `Button` : avec `href`, un lien à l'aspect d'un bouton ; `block` : pleine largeur, survol au palier `wide` (−1,2°) au lieu de `medium` (−1,6°) pour ne pas déborder sur les voisins. La règle `:active` est déclarée **après** les variantes, sinon l'inclinaison du survol l'emporte et le bouton ne s'enfonce pas au clic.
- `Chip`.
- `Counter` : − / saisie / +.
- `Field` : préfixe, erreur annoncée, `inputAttributes`.
- `FormError` : ligne d'erreur `role="alert"` avec l'icône d'alerte de 18 px ; seule forme d'erreur en ligne (champs, formulaires admin, fiche, liste, profil).
- `Modal`.
- `Panel` : bloc blanc à ombre.
- `Rule` : frise.
- `SearchField` : champ `type="search"` à loupe (20 px, 14 px en `small`, qui ne s'abaisse qu'à partir de 768 px), jetons de `Field`, nom accessible masqué (`label`) ; attributs natifs transmis au champ, évènement `input` émis après le modèle ; `focus()` et `getBoundingClientRect()` (le cadre) exposés pour les listes de propositions. Utilisé par `/list`, la liste d'un membre, le catalogue admin, `search/FilterGroup`, `admin/RecordPicker` et `admin/TagPicker` ; `layout/SearchBox` garde sa liste de suggestions.
- `Segmented` : choix unique en boutons accolés (`<fieldset>` de vrais `<input type="radio">` invisibles, `v-model` : le clavier est celui du navigateur), options `{ value, label, icon, shortLabel?, testId? }` ; au mobile le libellé court remplace l'icône, sans lui l'icône reste seule ; `prefix` (« Compter ») au bureau seulement. Options de `/list` et de la liste d'un membre : `useListControls`. Pas de segmenté dans l'admin (`PillGroup`).
- `StatePanel` : panneau d'état (liste vide, aucun résultat, erreur de chargement, profil privé) construit sur `Panel`, avec pastille ronde et icône (`book-off` par défaut, `alert-triangle` pour `tone="error"` qui ajoute `role="alert"`, `icon` pour un autre pictogramme), titre bleu de 1,25 rem, texte et bouton en slot ; une seule taille (pastille de 4 rem, marges de 24 px), pas de variante compacte.
- `Tabs` : `underline` : pas de barre de défilement, des chevrons collés aux bords signalent les onglets cachés.

## `work/` — œuvres
- `Card` : fiche résumée (couverture, titre, type).
- `Cover` : avec/sans image ; `size` = `sm` 64 · `md` 72 · `lg` 96 · `xl` 112 · `hero` 210 px (fluide sans `size`), `wideSize` à partir de 768 px ; jamais de `:deep(.cover)` pour la largeur (`utils/cover.spec.ts`) ; sans image : trame rose vif `--color-rose-vivid` sur bleu pâle `--color-cover-blank`.
- Blocs de la fiche : `Actions` (Lire/Acheter), `Info`, `People` (auteurs sur le web, repli au-delà de 3), `Rating` (note et membres), `Synopsis`, `Related`. Voir [fiche-oeuvre.md](fiche-oeuvre.md).

## `layout/` — structure du site
- `Header`.
- `LanguageSwitcher` : bouton sur toute la carte + menu de liens `useSwitchLocalePath`, pas de `<select>` natif ; menu pleine largeur sous l'en-tête sur mobile, aligné à droite au bureau ; fermeture par Échap, clic extérieur ou changement de route.
- `ExploreMenu`, `SearchBox` : voir [accueil-recherche.md](accueil-recherche.md). `AccountMenu` : voir [connexion-compte.md](connexion-compte.md).

## Autres dossiers
- `library/` (`StatusMenu`, `StatusList` : menu des cinq statuts partagé par la fiche et `list/StatusButton`, déclencheur en slot `trigger`, action de pied en slot `footer`, `Progress`, `RemoveConfirm` : confirmation rouge du retrait, partagée par la fiche et « Modifier ma lecture ») : [fiche-oeuvre.md](fiche-oeuvre.md).
- `list/` (`Summary`, `StatusButton`, `Row`, `GridItem`, `EditModal`) : [liste-et-profil.md](liste-et-profil.md).
- `admin/` (`WorkForm`, `PersonForm`, `PublisherForm`, `RowList`, `RecordPicker`, `LinksFields`, `PillGroup`, `TagPicker`, `Nav`, `Filters`, `FilterGroup`, `ResourceRows`, `RowMenu`, `ArchiveConfirm`) : [administration.md](administration.md).
- `home/` (`Pitch`, `ContinueReading`, `Featured`, `Shelf`, `Explore`) et `search/` (`Filters`, `FilterGroup`, `ResultItem`) : [accueil-recherche.md](accueil-recherche.md).
- `auth/` (`SignInModal`, `Notice`) : [connexion-compte.md](connexion-compte.md).

## Galerie `/components`
404 en production (`NODE_ENV=production`), sauf `NUXT_PUBLIC_COMPONENT_GALLERY=true` (les E2E et docker-compose l'activent) ; indicateur unique `runtimeConfig.public.componentGallery`.

## Layouts (`app/layouts/`)
Convention Nuxt : ce sont les coquilles qui entourent les pages. `default.vue` s'applique à toutes les pages (lien d'évitement, en-tête, zone de contenu `<slot />` qui s'étire sur toute la hauteur de la fenêtre : le contour de focus de `<main>` entoure toute la page) ; un autre layout (ex. connexion sans en-tête) se choisit par page avec `definePageMeta({ layout })`.
