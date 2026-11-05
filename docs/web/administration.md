# Web — Administration du catalogue

Comportement côté front (Nuxt) de l'administration (#26, US-11, maquette 22). Le « quoi » fonctionnel est dans les [spécifications](../specifications-fonctionnelles.md) (US-11). Composants : [composants.md](composants.md).

## Pages et accès
- `pages/admin/catalogue/index.vue` : l'adresse porte `kind`, `scope`, `q`, `page` (`utils/admin.ts`).
- `pages/admin/catalogue/[kind]/[id].vue` : `id` = `new` pour créer.
- Réservées par le middleware `admin` (visiteur ⇒ accueil, membre simple ⇒ 404).
- Appels par `utils/admin-client.ts` (`useAdminClient` transmet le cookie au rendu serveur), état d'édition par `useAdminEditor` (`useState` : le brouillon chargé au rendu serveur est repris par le navigateur).
- Un échec de validation affiche `admin.error.validation`, pas `error.VALIDATION_ERROR` (qui parle du pseudo).

## Formulaires
- `admin/WorkForm` (sections en onglets, toutes dans le formulaire, une seule visible), `PersonForm`, `PublisherForm`, construits sur `admin/RowList` (lignes modifiables), `RecordPicker` (recherche d'une fiche, `search` fourni par la page) et `LinksFields`.
- Saisie sécurisée par `inputAttributes.sanitize` de `UiField` (`digitsOnly`, `languageCode`).
- `admin/PillGroup` : choix en pastilles (type, statut, formats, natures). `admin/TagPicker` : choix multiple dans une longue liste (les genres), cherchée dans un champ, valeurs choisies en pastilles retirables.
- Libellé d'un code de genre : `useGenreLabel()`.
- Une fiche neuve repart toujours vide (l'état `useState` survit à la navigation). Une ligne d'auteur, d'éditeur ou d'œuvre liée sans fiche choisie, ou un lien avec libellé sans adresse, bloque l'enregistrement (`hasIncompleteRows`) au lieu d'être ignorée.
- Les fiches s'ouvrent en `UiButton to` (navigation sans rechargement) et `useAdminListLocation` mémorise la dernière liste : « Catalogue », « Annuler » et l'enregistrement y ramènent.

## Liste
- Chaque onglet a sa recherche (changer d'onglet la vide, `queryForTab`), son placeholder et son bouton de création (« Nouvelle œuvre / personne / éditeur », absent des archives).
- Les œuvres ont en plus `admin/Filters` : type, format, statut en `UiMultiSelect` (bouton à cadre, cases à cocher, OU dans un filtre, valeurs en liste séparée par des virgules dans l'adresse) ; tri A→Z / complétude en `UiSelect` plat ; « Réinitialiser » seulement si un filtre est actif. Leur recherche porte aussi sur le nom des auteurs (pas de champ « Auteur »).
- Barre `admin/Nav`, onglets soulignés (`UiTabs underline` : Œuvres, Personnes, Éditeurs et plateformes, Archives avec leur nombre pour le type en cours).
- Tableau `admin/ResourceRows` : type · format, auteur, statut, complétude, « Modifier » ou « Restaurer ». Archiver se fait depuis la fiche (bouton `danger`, enregistrer en `success`). La feuille « ⋮ » du mobile est `admin/RowMenu` (`v-model`, émet `restore` et `archive` ; la confirmation reste dans `ResourceRows`).
- `admin/FilterGroup` (cases sans compteurs, feuille de filtres mobile) reste distinct de `search/FilterGroup` (facettes, compteurs, recherche, « Voir les N autres »).
- Pastille ADMIN dans l'en-tête.

## Écarts avec la maquette
Pas de filtre « À compléter » (le tri par complétude le remplace) ni de couvertures (#27) ; les filtres et les menus de rôle ou de relation gardent le `UiSelect` du site.

## Version de la fiche
`GET /admin/works/{id}` donne `updatedAt`, gardé dans le brouillon (`WorkDraft.updatedAt`) et renvoyé au `PUT` ; si quelqu'un a enregistré entre-temps, `STALE_RECORD` (409) s'affiche sans quitter la fiche.

## Sortie de la fiche
`useAdminEditor` suit si la saisie a changé (`isDirty`, instantané pris au chargement et à l'enregistrement). La page pose un garde du routeur (`router.beforeEach`, retiré avec la page, pas `onBeforeRouteLeave` que les tests ne voient pas) qui ouvre `UiConfirm danger` « Quitter sans enregistrer ? » (`data-testid="leave-confirm"`), plus un `beforeunload` ; changer de section (`?section=`) ne la déclenche pas.

## Confirmation d'archivage unique
`admin/ArchiveConfirm` (`UiConfirm danger` + récapitulatif « Suivie par » / « Relations » d'une œuvre) sert la fiche et la feuille « ⋮ » de la liste. `ResourceRows` reçoit `loadImpact` (la page lit `GET /admin/works/{id}` à l'ouverture, `archiveImpact`) et reste utilisable si la lecture échoue. `GET /admin/works/{id}` renvoie aussi `labels`.

## Tests
E2E `e2e/tests/admin.spec.ts` : session du compte administrateur de démo (`support/admin.ts`) ; la confirmation d'archivage se cadre sur `getByRole('dialog')` (le menu de compte a la sienne).
