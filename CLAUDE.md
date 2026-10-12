# Trame

Plateforme de suivi de lecture et de découverte pour la **création alternative européenne, FR d'abord** (manga, BD, webtoons, webcomics d'auteurs indépendants). Un « MyAnimeList » de cette scène. Projet personnel, solo, gratuit au démarrage. **Phase actuelle : documentation, aucun code.**

## Démarrage de session
1. Lire ce fichier puis `private/etat-courant.md` (privé, ignoré par git). N'ouvrir d'autres documents que si la tâche l'exige.
2. Dès que le sujet est connu (demandé par Ryan, ou déduit de `private/etat-courant.md` § Prochaine tâche), nommer la conversation d'un titre court et explicite (≤ 6 mots, ex. « Issues et GitHub Project ») avec l'outil de titre de session, puis le réajuster si le sujet change.
3. Mettre à jour `private/etat-courant.md` **une seule fois, en fin de session ou si Ryan le demande**, jamais après chaque décision (coût en tokens). Décision technique structurante : un ADR. Réflexions et décisions stratégiques : `private/docs/genese.md`, seulement si Ryan le demande.

## Décisions clés (détail dans `docs/` et `docs/adr/`)
- Création indépendante européenne, FR d'abord ; **une œuvre = une fiche** ; modèle calqué sur MyAnimeList.
- i18n (ADR 0007) : interface FR au MVP, prête pour d'autres langues ; titres et synopsis par langue (`work_title`, `work_synopsis`), repli sur la langue originale ; pas de filtre de disponibilité ; codes d'énumération et de genre en anglais, libellés côté front.
- Compteurs **chapitres lus** et **tomes lus** indépendants : jamais mappés ni additionnés. Note /10. Pas d'édition, pas d'ISBN.
- `work.type` ∈ `series | oneshot | webcomic | collection` ; manga/manhwa/BD/webtoon/webcomic = **formats** et fantasy/humor… = **genres**, deux catégories de la table `genre`, multiples par œuvre et distinctes du type.
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
- **Tickets** : pas de travail sans ticket (le hook exige `type/n-slug`). Créer ou proposer tout ticket avec `gh issue create --repo VerlandeRyan/Trame --assignee "@me" --project Trame` + labels `type:*` et `area:*` ; pas de milestone si le sujet n'est pas lié à une phase. Au démarrage du travail sur un ticket, le passer en **In progress** dans le Project (`gh project field-list 1 --owner VerlandeRyan` pour les identifiants, puis `gh project item-edit`) ; Done est automatique à la fusion de la PR (`Closes #n`). Changement de sujet : si le ticket existe, donner à Ryan le nom de branche `type/n-slug` (il la crée) ; sinon créer le ticket d'abord, puis donner la branche.
- Technologies durables : Node LTS, TypeScript stable, aucune version préliminaire.

## Structure cible
`api/` (Node/TS, migrations) · `web/` (Nuxt) · `db/demo-data.sql` · `e2e/` · `docs/` · `private/` (ignoré) · `docker-compose.yml`.
Chaque sous-dossier aura son propre `CLAUDE.md` court (≤ 150 lignes) quand il existera.

## Documentation
Cadrage : `docs/cadrage.md`. Modèle de données : `docs/modele-de-donnees.md`. Spécifications : `docs/specifications-fonctionnelles.md`. Architecture et ADR : `docs/architecture.md`. Conventions : `docs/conventions-projet.md`.
