# ADR 0007 — i18n et contenu multilingue : périmètre européen, interface FR d'abord

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte
Le périmètre « création francophone uniquement » est trop étroit : la scène alternative européenne (Espagne, Allemagne, etc.) produit aussi des mangas, BD et webtoons d'auteurs indépendants. Une œuvre doit pouvoir être originale dans une autre langue, et un lecteur doit la voir et la suivre même si elle n'est pas (ou pas encore) éditée dans son pays. Les décisions sont prises avant l'import du catalogue et avant le front, car migrer après coûte plus cher.

## Décision
- **Périmètre** : création indépendante **européenne, FR d'abord**. Le catalogue de départ reste francophone ; le modèle accepte d'autres langues.
- **Deux notions de langue** : les *langues d'interface* (liste configurable, `fr` au MVP, fichiers de langue côté front) et les *langues de contenu* (code ISO 639 en minuscules, 2 lettres si elles existent, sinon 3 ; pas de variantes régionales au MVP).
- **Titres** : `work.title` est le titre original ; `work_title` (ex-titres alternatifs) porte `language` et `kind` (`translated`, `international`, `former`, `short`). Affichage : titre dans la langue de l'app s'il existe, sinon titre original.
- **Synopsis** : table `work_synopsis` (`work_id`, `language`, `text`, `source`). `source` : `official` (texte officiel de l'éditeur ou de l'auteur dans cette langue), `human` (traduction saisie), `machine` (traduction automatique). Préférence à l'affichage : langue de l'app en `official`, puis `human`, puis `machine`, puis langue originale.
- **Une seule table par type de contenu**, colonne `language` : ajouter une langue ajoute des lignes, jamais de table ni de colonne. Le passage à l'échelle passe par des index.
- **Langue originale** : `work.original_language`, obligatoire, sans valeur par défaut.
- **Disponibilité** : aucun filtre par pays ou par langue ; la fiche liste les liens « lire » et « acheter », sans dire « disponible chez vous ».
- **Codes en anglais** : valeurs d'énumération et codes de genre (`genre.code`) en anglais, libellés traduits côté front. Les codes `manga` et `bd` sont conservés.
- **Erreurs d'API** : `code` + champ + paramètres, sans message traduit ; le `message` de premier niveau est un texte technique en anglais. Le front lit `code`, jamais `message`.
- **URL** : contenu identique quelle que soit la langue (`/works/12`, `?genre=adventure`) ; langue d'interface en préfixe de chemin, français sans préfixe (`/en/works/12`) ; profils sous `/u/{handle}`. À confirmer au ticket du squelette Nuxt.
- **Traduction automatique** : outil et chaîne reportés ; au MVP, traductions saisies à la main uniquement. La colonne `source` prépare l'affichage « traduit automatiquement » et son remplacement par une saisie humaine.

## Alternatives écartées
Une table ou une colonne par langue (rigide, migration à chaque langue) ; libellés de genre traduits en base (inutile pour une liste courte et fermée) ; messages de validation traduits côté API (casse l'i18n, duplique le front) ; filtrer le catalogue par pays de l'utilisateur (contraire à l'objectif de découverte).

## Conséquences
+ Une fiche, plusieurs langues, repli sans trou ; ajout de langue sans migration ; front seul responsable de la traduction de l'interface.
− Plus de tables et de jointures sur la fiche ; saisie des traductions à la main au départ ; une migration préalable à l'import (codes en anglais, genres, langues) ; reprise des synopsis officiels à faire avec l'accord des ayants droit.
