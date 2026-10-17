# ADR 0007 — i18n et contenu multilingue : périmètre européen, interface FR d'abord

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte
Le périmètre « création francophone uniquement » est trop étroit : la scène alternative européenne (Espagne, Allemagne, etc.) produit aussi des mangas, BD et webtoons d'auteurs indépendants. Une œuvre doit pouvoir être originale dans une autre langue, et un lecteur doit la voir et la suivre même si elle n'est pas (ou pas encore) éditée dans son pays. Les décisions sont prises avant l'import du catalogue et avant le front, car migrer après coûte plus cher.

## Décision
- **Périmètre** : création **européenne, FR d'abord**. Le catalogue de départ reste francophone ; le modèle accepte d'autres langues. *(Mise à jour 2026-10-17 : le périmètre n'est pas limité à l'indépendant ; auteurs indépendants comme éditeurs établis y figurent.)*
- **Deux notions de langue** : les *langues d'interface* (liste configurable, `fr` au MVP, fichiers de langue côté front) et les *langues de contenu* (code ISO 639 en minuscules, 2 lettres si elles existent, sinon 3 ; pas de variantes régionales au MVP).
- **Titres** : `work.title` est le titre original ; `work_title` (ex-titres alternatifs) porte `language` et `kind` (`translated`, `international`, `former`, `short`). Affichage : titre dans la langue de l'app s'il existe, sinon titre original.
- **Synopsis** : table `work_synopsis` (`work_id`, `language`, `text`, `source`). `source` : `official` (texte officiel de l'éditeur ou de l'auteur dans cette langue), `human` (traduction saisie), `machine` (traduction automatique). Un seul synopsis par langue (clé `work_id`, `language`) ; la source la plus fiable l'emporte **à l'écriture** : `official` > `human` > `machine`, une source de rang inférieur n'écrase jamais une source de rang supérieur (une édition officielle remplace une traduction humaine). Affichage : synopsis de la langue de l'app, sinon celui de la langue originale ; l'interface signale la source (ex. « traduction communautaire »).
- **Une seule table par type de contenu**, colonne `language` : ajouter une langue ajoute des lignes, jamais de table ni de colonne. Le passage à l'échelle passe par des index.
- **Langue originale** : `work.original_language`, obligatoire, sans valeur par défaut.
- **Disponibilité** : aucun filtre par pays ou par langue ; la fiche liste les liens « lire » et « acheter », sans dire « disponible chez vous ».
- **Codes en anglais** : valeurs d'énumération et codes de genre (`genre.code`) en anglais, libellés traduits côté front. Les codes `manga` et `bd` sont conservés.
- **Formats et genres** : table `genre` (`code` stable, `category` = `format` ou `theme`). Le format (manga, manhwa, bd, webtoon, webcomic) dit comment l'œuvre est publiée et lue ; le genre dit de quoi elle parle ; les deux sont multiples par œuvre et distincts de `work.type`, qui dit la structure de l'histoire (`series`, `oneshot`, `anthology`) ; `webcomic` est un format, pas un type.
- **Erreurs d'API** : `code` + champ + paramètres, sans message traduit ; le `message` de premier niveau est un texte technique en anglais. Le front lit `code`, jamais `message`.
- **URL** : contenu identique quelle que soit la langue (`/works/12`, `?genre=adventure`) ; langue d'interface en préfixe de chemin, français sans préfixe (`/en/works/12`) ; profils sous `/u/{handle}`. À confirmer au ticket du squelette Nuxt.
- **Traduction automatique** : outil et chaîne reportés ; au MVP, traductions saisies à la main uniquement. La colonne `source` prépare l'affichage « traduit automatiquement » et son remplacement par une saisie humaine.

## Alternatives écartées
Une table ou une colonne par langue (rigide, migration à chaque langue) ; libellés de genre traduits en base (inutile pour une liste courte et fermée) ; messages de validation traduits côté API (casse l'i18n, duplique le front) ; filtrer le catalogue par pays de l'utilisateur (contraire à l'objectif de découverte).

## Conséquences
+ Une fiche, plusieurs langues, repli sans trou ; ajout de langue sans migration ; front seul responsable de la traduction de l'interface.
− Plus de tables et de jointures sur la fiche ; saisie des traductions à la main au départ ; une migration préalable à l'import (codes en anglais, genres, langues) ; reprise des synopsis officiels à faire avec l'accord des ayants droit.
