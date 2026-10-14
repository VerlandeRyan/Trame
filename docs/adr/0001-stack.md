# ADR 0001 — Stack : PostgreSQL + API Node/TypeScript + Nuxt

- **Statut** : accepté
- **Date** : 2026-10-09

## Contexte
Développeur solo, profil data (SQL, modélisation), Vue déjà pratiqué sur un projet précédent. Contraintes : SEO obligatoire sur les fiches, coût nul pour le MVP, démarrage en local, technologies durables et peu exotiques, reprise facile. Une API classique convient très bien.

## Décision
- Base : **PostgreSQL**, migrations SQL écrites à la main.
- API : **Node.js (LTS) + TypeScript** stable, REST + OpenAPI, validation d'entrée par schéma ; détails (framework, accès à la base, authentification) dans l'[ADR 0006](0006-choix-techniques-api.md) ; langues et contenu multilingue dans l'[ADR 0007](0007-i18n-et-contenu-multilingue.md) ; front (UI, icônes, i18n) dans l'[ADR 0008](0008-choix-techniques-web.md).
- Front : **Nuxt (Vue 3)** pour des pages rendues côté serveur.
- Authentification : Google OAuth, librairie maintenue, session en cookie `httpOnly`.
- Local : `docker compose up` (base, API, web).

## Alternatives
Supabase, React Native/Expo, Flutter, SQLite, NoSQL, TypeORM (voir [architecture.md](../architecture.md), section 6).

## Conséquences
+ Technologies standards, API ouverte possible, logique visible dans le code, hébergement choisi plus tard.
− Authentification, stockage de fichiers et administration sont à construire (périmètre restreint).
− Plus de code serveur qu'avec un backend tout prêt.
