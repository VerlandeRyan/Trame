# Web — Fiche œuvre et fiche de lecture

Comportement de l'écran `/work/{id}-{slug}` côté front (Nuxt). Le « quoi » fonctionnel est dans les [spécifications](../specifications-fonctionnelles.md) (US-03, US-05, US-06) ; ici, le « comment » et les pièges. Règles générales du front : [web/CLAUDE.md](../../web/CLAUDE.md) et [conventions §12](../conventions-projet.md). Catalogue des composants : [composants.md](composants.md).

## Fiche œuvre
`pages/work/[slug].vue`, URL `/work/{id}-{slug}` (`/en/work/…`), un seul chemin pour toutes les langues (le préfixe change la langue).
- Seul l'`id` est lu ; slug erroné ⇒ 301 vers le canonique (calculé sur le titre affiché dans la langue de l'interface, comme les liens des œuvres liées) ; inconnue ⇒ 404.
- SEO : `useSeoMeta`, `useLocaleHead({ seo: true })` (canonical, hreflang), JSON-LD sérialisé par `serializeJsonLd`.
- Logique pure et types de la réponse dans `utils/work.ts`.
- Libellés des codes (`genre.*`, `workStatus.*`, `relationGroup.*`) en clés i18n ; un code absent s'affiche tel quel.
- Blocs `work/` : `Actions` (Lire/Acheter), `Info`, `People` (auteurs sur le web, repli au-delà de 3), `Rating` (note et membres), `Synopsis`, `Related`.

## Fiche de lecture (#23, US-05/06)
Deux composants d'après les maquettes de la fiche œuvre, pilotés par `pages/work/[slug].vue` (qui possède `useLibraryEntry`).

### `library/StatusMenu`
Colonne de gauche, au-dessus de « Lire / Acheter » ; sous le titre au mobile.
- « Ajouter à ma liste + » (une seule ligne) pour un visiteur (ouvre la fenêtre de connexion) ou une œuvre absente de la liste (ajout en « À lire »).
- Puis le bouton **de la couleur du statut** (`UiButton status`, « En cours ▾ ») qui ouvre un menu `role="menu"` : les 5 statuts puis **« Retirer de ma liste »** avec `UiConfirm danger` (rouge, comme dans « Modifier ma lecture »). Style des menus de choix : [conventions §12](../conventions-projet.md).
- Erreur d'API en `role="alert"` dessous (`libraryErrorKey`, `library.error.*`, jamais le `VALIDATION_ERROR` du pseudo).

### `library/Progress`
Colonne principale, après « Note / Membres », **avant** au mobile.
- « Ma progression » = `UiCounter` chapitres et tomes **indépendants** (« sur N » ou « sur ? »).
- « Ma note » (même compteur, 0 affiché « — » ↔ `rating: null`, « sur 10 »). La note reste de 1 à 10 (0 du compteur = pas de note).
- Puis les dates de lecture (`<input type="date">` côte à côte, repliées sous « Dates de lecture » : absentes de la maquette de la fiche mais exigées par US-06).
- Avertissement non bloquant « plus que les N parus » (`exceedsKnownTotal`).
- Les compteurs sont `UiCounter compact` : boutons de 24 px comme la maquette, `padding: 0` pour centrer l'icône, même survol que les flèches du carrousel (fond `--color-cover-empty`, ombre, −1 px) ; zone de clic de 44 px de haut **au doigt seulement**, qui s'arrête au bord de la valeur. Le panneau resserre ses compteurs par `@container` (`--counter-gap`, `--counter-value-width`) et la police de la valeur rétrécit à partir de 4 chiffres.

### Confirmations (`useReadingPrompt`, partagé avec la liste et l'accueil)
- **Commencer ou reprendre** : un chapitre ou un tome de plus sur une œuvre « À lire », « En pause » ou « Abandonné » ouvre une confirmation (`readingPrompt`, dans `Progress`) : « Tu as commencé cette œuvre ? » ou « Reprendre la lecture ? ». **Seule la confirmation enregistre** (compteur et statut « En cours », le serveur propose alors la date de début) ; Annuler, la croix, Échap et un clic à côté n'enregistrent rien et `Progress` recrée les compteurs (`counterKey`) pour qu'ils reprennent la vraie valeur.
- **Total connu atteint** (chapitres ou tomes, franchi en montant, `finishChapters` / `finishVolumes`, prioritaire sur « En cours ») : « Tu as fini cette œuvre ? ». La confirmation passe en « Terminé » (le serveur propose la date de fin) ; « Garder « statut » » enregistre le compteur **seul** (sinon on ne pourrait pas saisir le total) ; la croix et Échap n'enregistrent rien (`UiConfirm` émet `cancel` pour le bouton de refus seulement). Un total connu veut dire que la publication est finie.
- **Passer en « Terminé » à la main** (menu de statut de la fiche, `StatusButton` de la liste, « Modifier ma lecture ») avec un compteur sous le total connu ouvre `completeCounters` (« Compteurs au total ? ») : la confirmation met seulement les compteurs en dessous aux totaux parus (`countersToTotals`) avec le statut, « Garder mes compteurs » enregistre le statut seul, la croix et Échap n'enregistrent rien. Rien n'est proposé sans total connu ni si les compteurs y sont déjà (dans la fenêtre de modification, seul un passage en « Terminé » déclenche une question).

### Chargement et enregistrement
- **Pas de clignotement au rechargement** : la page lit l'entrée dès le rendu serveur (`useLibraryEntry` : `useState` + cookie du visiteur transmis), le HTML arrive donc avec le bon bouton ; tant que l'état est inconnu (arrivée par un lien du site, ou lecture serveur échouée) `StatusMenu` montre un emplacement neutre (`library-loading`) et jamais « Ajouter ». Un échec de lecture au rendu serveur laisse « non chargé » : le navigateur réessaie.
- L'entrée est lue **dans le navigateur** au montage (pas au rendu serveur) ; chaque modification est enregistrée aussitôt par `PUT /works/:id/entry` (seul le champ modifié est envoyé).

### Tests
- Les `UiConfirm` du menu de compte et du menu de statut partagent leurs `data-testid` : cadrer les E2E sur `getByRole('dialog')` ou `library-status-menu`.
- Les E2E de la fiche de lecture utilisent l'œuvre n° 5, en série, et retirent leur entrée (les entrées comptent dans « Membres » et dans « À la une »).
