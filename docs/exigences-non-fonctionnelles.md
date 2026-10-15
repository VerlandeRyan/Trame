# Exigences non fonctionnelles

> Statut : brouillon v0.1 — 2026-10-09 — les cibles chiffrées sont indicatives, à valider à l'usage

## 1. SEO (obligatoire)
- Pages publiques (fiches, auteurs, éditeurs, profils publics, accueil) **rendues côté serveur** : le contenu est dans le HTML initial.
- URL stables `/work/{id}-{slug}`, balise `canonical`, redirection vers l'URL canonique si le slug est erroné.
- `title` et `meta description` uniques par page ; balises Open Graph et Twitter pour le partage ; balisage structuré schema.org (`CreativeWork` / `ComicSeries` / `Person` selon le cas).
- `sitemap.xml` généré, `robots.txt`, aucune indexation des zones privées ni des pages d'administration.
- Cible : score Lighthouse SEO ≥ 95 sur les fiches.

## 2. Performance
- Cibles indicatives sur mobile milieu de gamme : LCP < 2,5 s, CLS < 0,1 ; recherche instantanée perçue < 300 ms.
- Images : redimensionnées à l'upload (2–3 tailles WebP), chargement différé, dimensions déclarées.
- Pagination ou défilement progressif des listes ; aucune liste de plus de ~50 éléments chargée d'un bloc.
- Cache HTTP sur les pages publiques et les images.
- Budgets suivis en CI (Lighthouse CI).

## 3. Accessibilité et ergonomie
- Niveau visé **WCAG 2.2 AA** : contrastes, navigation clavier, libellés, textes alternatifs, `aria` quand nécessaire.
- Conception **mobile d'abord**, responsive ; tailles en `rem`/`em`/`%` ; cibles tactiles confortables.
- Mode clair/sombre à considérer en phase 2.
- Vérification automatique avec axe-core dans les tests E2E.

## 4. Sécurité
- Authentification par Google (OAuth) ; **aucun mot de passe stocké** ; session par cookie `httpOnly`, `Secure`, `SameSite`.
- Contrôle d'accès côté API (rôles `user` / `admin`) ; toute écriture sensible vérifiée côté serveur.
- Entrées validées à la frontière de l'API (schémas) ; **requêtes SQL toujours paramétrées** ; pas de SQL brut non relu.
- Sorties échappées ; aucun `v-html` sur du contenu utilisateur ; en-têtes de sécurité (CSP, X-Content-Type-Options, Referrer-Policy) ; liens externes en `https://` avec `rel="noopener noreferrer"`.
- Limitation de débit sur la connexion, la recherche et la soumission.
- Rôle de base de données applicatif à droits minimaux (pas de DDL).
- Secrets dans l'environnement, jamais dans le dépôt ; `gitleaks` en hook local et en CI ; Renovate/Dependabot pour les dépendances.
- Dépôt public : voir les garde-fous dans [conventions-projet.md](conventions-projet.md).

## 5. Données personnelles (RGPD) et juridique
- Données collectées : e-mail, identifiant Google, handle, nom affiché, liste de lecture, notes. Rien d'autre.
- Base légale : exécution du service (compte) ; consentement pour tout traceur non essentiel ; mesure d'audience respectueuse de la vie privée, sans cookie, si utilisée.
- Droits : accès, rectification, **suppression du compte** (US-12), export des données sur demande.
- Pages obligatoires : mentions légales, politique de confidentialité, conditions d'utilisation, page de contact/retrait de contenu.
- Hébergement des données : à choisir en tenant compte de la localisation (UE de préférence).

## 6. Compatibilité
- Navigateurs récents (deux dernières versions majeures de Chrome, Firefox, Safari, Edge) ; iOS Safari et Chrome Android prioritaires.
- Installable en PWA (manifeste, icônes) ; fonctionnement dégradé hors ligne à étudier plus tard.
- Aucune dépendance à un navigateur ou à un appareil spécifique.

## 7. Sauvegardes et exploitation
- Sauvegarde de la base par `pg_dump` planifiée, stockée **hors dépôt** ; objectif de perte maximale : 24 h.
- **Test de restauration** au moins une fois par trimestre et avant toute migration risquée.
- Journalisation applicative sans donnée personnelle superflue ; suivi d'erreurs minimal (à choisir).
- Migrations SQL versionnées, appliquées automatiquement au démarrage (pratique déjà éprouvée sur un projet précédent).

## 8. Maintenabilité
- Technologies durables : Node LTS, TypeScript stable, aucune version préliminaire.
- Couverture de tests visée : logique métier de l'API et composants clés ; E2E sur les parcours principaux.
- Décisions structurantes tracées en ADR ; documentation tenue à jour dans le dépôt.
