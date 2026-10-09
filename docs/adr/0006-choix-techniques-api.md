# ADR 0006 — Choix techniques de l'API : Express 5, Kysely sur pg, node-pg-migrate, Google + sessions

- **Statut** : accepté
- **Date** : 2026-10-10

## Contexte
L'ADR 0001 laissait trois points ouverts : framework, accès à la base, authentification. Contraintes : technologies durables et peu exotiques, reprise facile, API REST + OpenAPI, connexion Google uniquement, solo, sécurité élevée.

## Décision
- **Framework** : **Express 5** (déjà pratiqué, très répandu).
- **Accès à la base** : **Kysely** au-dessus du pilote **`pg`**, sans ORM. Types générés depuis la base (`kysely-codegen`) ; requêtes toujours paramétrées. Tout le SQL reste dans la couche « repositories ».
- **Migrations** : **`node-pg-migrate`**, fichiers SQL horodatés écrits à la main ; la base est la définition de référence des champs et contraintes.
- **Validation** : schémas **Zod** à l'entrée de l'API ; documentation OpenAPI générée à partir des mêmes schémas.
- **Authentification** : **`google-auth-library`** (connexion Google, vérification du jeton) + **`express-session`** avec stockage PostgreSQL ; cookie `httpOnly`, `Secure`, `SameSite`. Aucun mot de passe stocké ; sessions révocables côté serveur.
- Maintenance des paquets (express-session, connecteur de stockage, google-auth-library, outil de génération des types) à vérifier avant installation.

## Alternatives écartées
Fastify (bon choix, moins connu de Ryan) ; TypeORM (décorateurs et compilation imposés) ; Drizzle (le schéma vit dans le code, pas dans la base) ; `pg` seul (types à écrire à la main, requêtes dynamiques plus risquées) ; Better Auth (tables propres, évolue vite) ; Auth.js (maintenance seule) ; Passport (modules Google peu mis à jour) ; JWT (révocation plus complexe).

## Conséquences
+ Piles connues, SQL visible, types alignés sur la base, requêtes dynamiques sûres par construction.
− Une dépendance de plus (Kysely) ; schémas Zod à tenir alignés avec les contraintes SQL ; sessions à tester (CSRF, expiration).
