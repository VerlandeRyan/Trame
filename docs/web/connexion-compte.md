# Web — Connexion, inscription et menu de compte

Comportement côté front (Nuxt) de la connexion Google, de l'inscription (choix du pseudo) et du menu de compte (#104, #98, maquettes 15/16, US-04). Le « quoi » fonctionnel est dans les [spécifications](../specifications-fonctionnelles.md) (US-04) ; les routes `/auth` sont dans [architecture.md](../architecture.md) §3. Composants : [composants.md](composants.md).

## Session
`plugins/auth.ts` lit `GET /auth/me` au rendu serveur, seulement si le cookie de session est présent (délai maximal de 3 s ; le `Set-Cookie` de prolongation est renvoyé au navigateur) dans `useAuth()` (`useState('auth')` : `anonymous | pending | authenticated`, `createAccount`, `signOut('logout' | 'cancel')`).

## Fenêtre de connexion
- `auth/SignInModal` : montée une fois dans `layouts/default.vue`, ouverte par `useSignInModal()` depuis « Se connecter » et « Créer ma liste de lecture » ; feuille basse au mobile via `useNarrowScreen`.
- « Continuer avec Google » est un **lien** (`UiButton href`, navigation complète) vers `/api/v1/auth/google?returnTo=<page courante>` ; `returnTo` est toujours revalidé par `safeReturnTo` (chemin du site seulement).
- **Fenêtre** : `UiModal plain` (sans filet, titre bleu de 20 px, croix de 28 px à zone tactile de 44 px), tailles de la maquette 15 ; boutons pleine largeur en `UiButton block`.
- **Langue** : l'API ramène sur `/en/signup/handle` et `/en/?auth_error=` quand le `returnTo` commence par `/en` (le parcours reste dans la langue de la page d'origine).

## Choix du pseudo
- L'API ramène sur `/signup/handle` (`pages/signup/handle.vue`, layout `signup` : logo seul).
- Validation locale 3–30 `[A-Za-z0-9_-]` (`isValidHandle`), erreurs `HANDLE_TAKEN` / `HANDLE_NOT_ALLOWED` lues dans la réponse de `POST /auth/handle` (**pas de « pseudo disponible » en direct** : pas de route de vérification, écart assumé avec la maquette 15).
- `SIGNUP_EXPIRED` ⇒ accueil avec avis ; « Annuler l'inscription » ⇒ `POST /auth/cancel`. Sans inscription en attente la page renvoie à l'accueil.

## Avis (`auth/Notice`)
- Affiché dans le layout par défaut : avis de `/?auth_error=` (`cancelled` ou code d'erreur) puis nettoyage de l'URL.
- Il affiche aussi l'avis posé par le code (`useAuthNotice()` : « Tu es déconnecté » en vert après une déconnexion, « Déconnexion impossible… » en rouge si elle échoue), qui disparaît à la navigation suivante (sauf `keepOnce`, posé avant une redirection : il survit à ce changement d'adresse seulement, `auth/Notice` ne l'efface qu'au suivant).
- Se déconnecter depuis une page réservée (middleware `authenticated` ou `admin`) ramène à l'accueil : les middlewares ne jouent qu'à la navigation.
- Teintes : jaune = information (annulations), vert = réussite, rouge = erreur (codes d'erreur de l'API, échecs).

## Menu de compte (`layout/AccountMenu`, #98)
- En-tête connecté : `@pseudo`, « Ma liste de lecture » et « Mon profil » (liens, #25), puis « Proposer une œuvre » et « Mes soumissions » **visibles mais inactifs** en attendant leur ticket, groupe « Administration » (Soumissions, Catalogue, Signalements, inactifs, sans compteurs) si `isAdmin` fourni par `Header`, enfin « Se déconnecter » avec confirmation `UiConfirm`.
- Panneau de 280 px **à plat** comme la maquette `accueil-v2` : pseudo avec avatar, lignes de 52 px à filet et chevron, « Se déconnecter » en rouge, aucun cadre de bouton ; défilant sur petit écran.
- Fermeture par clic extérieur et Échap : `useDismissableMenu` (partagé avec `LanguageSwitcher`).
- Un échec de déconnexion ou d'abandon est annoncé, jamais silencieux.
