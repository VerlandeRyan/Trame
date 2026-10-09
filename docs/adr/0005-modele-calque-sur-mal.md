# ADR 0005 — Modèle de données calqué sur MyAnimeList

- **Statut** : accepté
- **Date** : 2026-10-09

## Contexte
Une première analyse proposait des entités plus fines (édition, support, tome) pour couvrir réimpressions, éditions deluxe et versions web/papier. Ryan ne veut pas de notion d'édition, veut rester sur « la base de la base », et vise un « MAL » de la création francophone alternative. MAL expose précisément un type, des chapitres, des volumes, des dates, des éditeurs de publication et, côté utilisateur, des compteurs chapitres lus / volumes lus indépendants.

## Décision
- Une œuvre = une fiche. `work.type` ∈ `serie`, `oneshot`, `webcomic`, `recueil` (format d'origine).
- `work.chapters` et `work.volumes` indépendants ; côté utilisateur, `chapters_read` et `volumes_read` **jamais mappés ni additionnés** ni soumis à une règle de cohérence.
- Pas d'ISBN, pas d'édition, pas d'entité « support » dans le MVP. Une œuvre en ligne puis éditée en papier (BICLY) reste une seule fiche.
- Manga/BD = étiquette (`genre`), pas un type.
- Éditeur/plateforme générique et facultatif (le « magazine de prépublication » de MAL ne s'applique pas à cette scène).
- Relations entre œuvres via `work_relation` (suite, préquelle, spin-off, etc.).
- Identifiant interne `id` ; URL `/oeuvre/{id}-{slug}` où seul l'`id` compte.

## Alternatives
Entités édition/support/tome ; clés naturelles par ISBN ; table de franchises dédiée (reportée).

## Conséquences
+ Modèle simple, proche d'un standard connu, faible charge de saisie.
− Pas de suivi par édition ; impossible de mapper chapitres et tomes (assumé).
