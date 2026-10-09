# ADR 0002 — Les données du catalogue ne sont pas dans git

- **Statut** : accepté
- **Date** : 2026-10-09

## Contexte
Une première idée consistait à garder le catalogue dans des fichiers YAML versionnés. Ryan n'est pas à l'aise avec des données dans le dépôt, qui est public ; il y a en plus des questions de droits (couvertures, synopsis) et de sécurité (contenu malveillant via contribution, fuite).

## Décision
- Le catalogue vit **dans PostgreSQL dès le premier jour**, qui est la source de vérité.
- Le dépôt contient le code, la documentation et un **jeu de démonstration fictif** (`db/demo-data.sql`).
- Saisie initiale par tableur (hors git) et script d'import ; puis interface d'administration dans l'application.
- Sauvegardes par `pg_dump` planifié, stockées hors dépôt.
- Les images vivent dans le stockage d'images, jamais dans git.

## Alternatives
Fichiers YAML versionnés comme source de vérité (écartée : droits, sécurité, double source de vérité une fois le site en ligne).

## Conséquences
+ Dépôt public sans arrière-pensée ; retrait d'une donnée ou d'une image en une minute ; une seule source de vérité.
− Il faut prévoir la sauvegarde et un outil d'import/saisie.
