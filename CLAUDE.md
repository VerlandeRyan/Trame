# Trame

Plateforme de suivi de lecture et de découverte pour la **création francophone alternative** (manga, BD, webtoons, webcomics d'auteurs francophones et indés). Un « MyAnimeList » de cette scène. Projet personnel, solo, gratuit au démarrage. **Phase actuelle : documentation, aucun code.**

## Démarrage de session
1. Lire ce fichier puis `private/etat-courant.md` (privé, ignoré par git). N'ouvrir d'autres documents que si la tâche l'exige.
2. Mettre à jour `private/etat-courant.md` **une seule fois, en fin de session ou si Ryan le demande**, jamais après chaque décision (coût en tokens). Décision technique structurante : un ADR. Réflexions et décisions stratégiques : `private/docs/genese.md`, seulement si Ryan le demande.

## Décisions clés (détail dans `docs/` et `docs/adr/`)
- Création francophone uniquement ; **une œuvre = une fiche** ; modèle calqué sur MyAnimeList.
- Compteurs **chapitres lus** et **tomes lus** indépendants : jamais mappés ni additionnés. Note /10. Pas d'édition, pas d'ISBN.
- `work.type` ∈ `serie | oneshot | webcomic | recueil` ; manga/BD = étiquette de genre.
- Stack : **PostgreSQL + API Node/TypeScript (REST) + Nuxt (Vue 3)**. Supabase écarté. Mobile : **web + PWA d'abord**.
- Connexion Google uniquement. Rôles `user` / `admin`. Suppression = archivage admin (`deleted_at`/`deleted_by`).
- Les données du catalogue sont **en base, pas dans git**. Images hors git. Le dépôt ne contient qu'un jeu de démo fictif.
- Hors MVP : avis, discussions, e-mails, import MAL/AniList, votes, notifications, stores.

## Sécurité (dépôt PUBLIC)
- Jamais de secret, de donnée réelle du catalogue, d'image, ni de contenu de `private/` ou de `.env` dans le dépôt, les docs, les prompts ou la conversation.
- **Aucune information sur le poste de travail ou l'environnement personnel de Ryan** (versions d'outils installés, logiciels présents, chemins locaux, configuration) dans le dépôt ni dans `docs/`.
- `docs/` doit rester publiable sans regret : uniquement ce dont un lecteur ou contributeur a besoin. Stratégie, analyse juridique, budgets, historique de réflexion et références de comptes vont dans `private/` (ignoré par git).
- Pas de fichier LICENSE pour l'instant. SQL toujours paramétré ; pas de `v-html` sur du contenu utilisateur.
- Erreurs d'API : codes stables (ex. `ADMIN_REQUIRED`), jamais de JSON d'erreur improvisé.

## Façon de travailler
- Répondre en français. Modifier les fichiers avec Edit/Write (diffs visibles), jamais par script shell.
- Regrouper les modifications liées puis faire **une** vérification ; ne pas relire ce qui est déjà en contexte.
- Rester sur la tâche demandée ; poser une question courte plutôt que supposer (licence, hébergement, périmètre, droits).
- Tout changement de comportement ⇒ test E2E ; toute évolution de schéma ⇒ migration + `docs/modele-de-donnees.md`.
- Tests E2E : lancer seulement les nouveaux/modifiés en local ; la CI exécute la suite complète.
- **Git : Ryan garde la main complète.** Ne jamais exécuter de commande git qui écrit (`add`, `commit`, `push`, `merge`, `rebase`, `reset`, `tag`, config du dépôt…). Seule la lecture (`status`, `diff`, `log`) est permise. En fin de tâche, proposer un message de commit prêt à copier. Commits : `type(scope): message (#n)` ; branches `feat/12-slug`.
- Technologies durables : Node LTS, TypeScript stable, aucune version préliminaire.

## Structure cible
`api/` (Node/TS, migrations) · `web/` (Nuxt) · `db/demo-data.sql` · `e2e/` · `docs/` · `private/` (ignoré) · `docker-compose.yml`.
Chaque sous-dossier aura son propre `CLAUDE.md` court (≤ 150 lignes) quand il existera.

## Documentation
Cadrage : `docs/cadrage.md`. Modèle de données : `docs/modele-de-donnees.md`. Spécifications : `docs/specifications-fonctionnelles.md`. Architecture et ADR : `docs/architecture.md`. Conventions : `docs/conventions-projet.md`.
