# Web — Ma liste de lecture et profil public

Comportement côté front (Nuxt) des écrans `/list` et `/u/{handle}`. Le « quoi » fonctionnel est dans les [spécifications](../specifications-fonctionnelles.md) (US-07, US-08). Fiche de lecture et confirmations partagées : [fiche-oeuvre.md](fiche-oeuvre.md). Composants : [composants.md](composants.md).

## Ma liste de lecture (#24, US-07, maquettes 09/10)
`pages/list.vue` (`/list`, `/en/list`, `noindex`), réservée aux membres par le middleware `authenticated` (un visiteur revient à l'accueil ; la fenêtre de connexion s'ouvre seulement en navigation dans le site, pas à l'arrivée directe : l'état d'une `useState` ne rouvre pas un `<dialog>` à l'hydratation).

### Adresse et données
- **L'URL porte** l'onglet de statut (`status`), la recherche (`q`), le tri (`sort` : `updated`, `title`, `rating`) et la vue (`view=grid`) : `parseListQuery` / `toListRouteQuery` (les valeurs par défaut n'y figurent pas) / `toListApiQuery` dans `utils/reading-list.ts` (noms distincts de ceux de `utils/search.ts` : les auto-imports se marcheraient dessus).
- `composables/useReadingList` lit la première page au rendu serveur (`GET /me/entries`, cookie transmis), charge la suite au défilement (`IntersectionObserver` sur un repère + bouton « Charger la suite », pages de 50, doublons écartés) et enregistre chaque changement par `PUT/DELETE /works/:id/entry` **en le montrant aussitôt** : onglets et totaux sont recalculés localement (`applyEntryChangeToCounts`), une œuvre qui change d'onglet quitte la liste affichée, un échec relit la première page.
- Les écritures passent par `useOptimisticWrite` (affichage immédiat, `useRequestQueue` : une à la fois, la dernière réponse fait foi ; en cas d'échec `errorKey` puis `revert` de l'étape, sinon `resync`), partagé avec `useLibraryEntry` et `useContinueReading` : toute nouvelle écriture à effet immédiat l'utilise.
- La question « commencer / reprendre / terminé » est le composable `useReadingPrompt` (partagé avec `library/Progress`) : seule la confirmation enregistre.

### Composants `list/`
- `Summary` (deux totaux séparés).
- `StatusPicker` : menu des statuts d'une ligne, qui s'ouvre au-dessus du bouton près du bas de l'écran (`shouldOpenAbove` dans `utils/menu.ts`).
- `Row` : carte au mobile, ligne au bureau (colonnes `--list-columns` posées par la page, libellés des compteurs lus par les lecteurs d'écran mais masqués au bureau).
- `GridItem` : couverture à liseré de statut, pastille « Ch. 12 » ou « Ch. 86/86 », boutons −1/+1 de 44 px.
  - Au doigt, glisser vers la **gauche** fait +1 (la suite, comme le carrousel : `swipeDirection` tel quel) et vers la droite −1.
  - La couverture suit le doigt (`dragOffset`, amorti à 0,8 et borné à 84 px), laisse voir la couleur du statut et « +1 » / « −1 » dessous (`dragProgress` règle l'opacité), puis revient en rebondissant au relâchement ; la pastille rebondit à chaque −1 / +1.
  - Ressort et rebond sous `prefers-reduced-motion: no-preference` ; `touch-action: pan-y`, un glissement n'ouvre pas la fiche.
- `EditModal` (« Modifier ma lecture ») : le brouillon repart de l'entrée à chaque ouverture, seuls les champs modifiés sont envoyés, une date vide l'efface ; émettre **avant** de fermer, la fermeture fait oublier l'œuvre à la page.
- `ui/Segmented` (options de `useListControls`) : la grille compte au choix les chapitres ou les tomes (état local) par « Compter [Chapitres | Tomes] » (avec icônes au bureau, « Ch. | Tomes » au mobile) posé sur la ligne « N œuvres » au-dessus de la grille. L'aide (sous « N œuvres », **au-dessus** des couvertures) suit l'unité et l'appareil : le glisser n'existe qu'au doigt, à la souris elle parle des boutons −1 / +1.

### Apparence
- Ombre de la couverture = couleur du statut (`--grid-status`) cernée d'un filet d'encre.
- **Survol des pastilles de la page** (statuts, Liste/Grille, unité) : `--color-cover-empty` comme les boutons secondaires, sans animation.
- **Mobile allégé** : la bascule Liste/Grille est à côté du titre, les totaux tiennent en une ligne (`list/Summary` : les deux cartes et la phrase restent dans la page, masquées, pour les lecteurs d'écran), puis pastilles de statut, recherche + tri.

### Tests
- `list.spec.ts` vide la clé `useAsyncData` (`clearNuxtData`), sinon un test relit la liste du précédent.
- E2E `e2e/tests/list.spec.ts` sur les œuvres 2, 3 et 4 (sans lecteur ni ajout récent), entrées retirées après chaque test (dès 3 ajouts une œuvre entre dans « À la une »).

## Profil public (#25, US-08, maquettes 11 à 13)
`pages/u/[handle]/index.vue` (`/u/{handle}`, `/en/u/…`, rendu serveur, cookie transmis pour reconnaître le propriétaire ; inconnu ⇒ 404 ; `noindex` si privé).
- Contenu : monogramme sur trame (initiales, pas de photo), « Membre depuis », totaux chapitres/tomes séparés, œuvres suivies, note moyenne, barre et lignes de statuts (liens vers la liste filtrée), « Dernières mises à jour », « Les mieux notées ».
- Profil privé vu par un tiers : panneau « Ce profil est privé ».
- Le propriétaire a en plus l'état de visibilité (`PATCH /me/profile`, ajoutée aux écritures du relais), « Passer en privé / public » et « Copier le lien de mon profil » (profil public seulement).
- `pages/u/[handle]/list.vue` : la liste d'un membre **en lecture seule** (`useReadingList(state, '/users/{handle}/entries')`, `ListRow` / `ListGridItem` avec `is-read-only`) ; profil privé ⇒ panneau, pas de défilement continu (bouton « Charger la suite »).
- « Mon profil » du menu de compte est un lien. Logique pure dans `utils/profile.ts`.
- Les messages i18n qui contiennent un `@` l'écrivent `{'@'}` (sinon vue-i18n y voit un lien de message).
- Les Réglages (suppression du compte, #34) et « Historique » ne sont pas faits.
