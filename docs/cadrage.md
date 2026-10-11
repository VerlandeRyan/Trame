# Cadrage du projet Trame

> Statut : brouillon v0.1 — 2026-10-09 — à relire par Ryan

## 1. Contexte et problème
MyAnimeList et AniList sont centrés sur le Japon et l'Asie ; la création européenne et indépendante, francophone comprise, y est marginale ou absente. Les sites BD historiques (BDGest, etc.) sont orientés collection et catalogue, avec des ergonomies peu adaptées au mobile et au format feuilleton (webtoons, webcomics, prépublication en ligne).
Il manque un endroit simple, beau et rapide pour **suivre ce qu'on lit** dans la scène alternative européenne, francophone d'abord (Mangadraft, webtoons d'auteurs, auto-édition, petits éditeurs), et pour **découvrir** ces œuvres.

## 2. Vision
Un objet numérique minimaliste et fluide, à la manière de MyAnimeList (et de ses clients tiers) mais dédié à la création alternative européenne, francophone d'abord : une fiche par œuvre, un suivi précis sans friction, un profil partageable, une mise en avant des auteurs indépendants.

## 3. Objectifs
| # | Objectif | Mesure |
|---|---|---|
| O1 | Remplacer mes notes personnelles (Google Keep) pour suivre mes lectures | Critère de réussite : **après un mois d'usage, je préfère Trame à mes notes** |
| O2 | Offrir un catalogue crédible de la scène alternative, francophone d'abord | 100–300 fiches soignées au lancement du MVP |
| O3 | Être trouvable : chaque fiche indexable par les moteurs de recherche | Fiches rendues côté serveur, sitemap, balisage structuré |
| O4 | Rester un projet maintenable seul, à coût nul pour le MVP | 0 € en local ; outils gratuits ; technologies durables |

Hors objectifs : croissance d'audience, communauté (avis, discussions). Ils pourront venir plus tard.

## 4. Public
- **Lecteur de la scène alternative** (cible principale, dont moi) : lit des webtoons, des tomes d'éditeurs indés, des œuvres Mangadraft ; veut noter, suivre où il en est, retrouver ce qu'il a lu.
- **Auteur / éditeur indépendant** (cible secondaire) : veut une vitrine gratuite pour son œuvre et pouvoir en corriger la fiche.
- **Administrateur** : moi, pour saisir et valider le catalogue.

## 5. Périmètre
### Dans le MVP
- Recherche instantanée (titre, auteur, éditeur/plateforme).
- Fiche œuvre épurée (couverture, synopsis, auteurs, statut, liens, œuvres liées).
- Suivi de lecture : 5 statuts (En cours, Terminé, À lire, En pause, Abandonné), **compteurs chapitres lus et tomes lus indépendants**, note sur 10 optionnelle.
- Profil utilisateur public à URL propre.
- Connexion avec un compte Google.
- Soumission minimale d'œuvres manquantes, validée par un administrateur.
- Interface d'administration de saisie et de validation.

### Hors MVP (décidé)
Calendrier des sorties à venir (rôle de MangaCollec), œuvres pour adultes (non référencées), avis et discussions, relectures, e-mails de synthèse, import depuis MAL/AniList, votes, notifications, applications sur les stores, ISBN, notion d'édition (classique/deluxe), listes personnalisées.

## 6. Hypothèses
- La scène alternative francophone, ouverte ensuite à l'Europe, est trop petite pour être couverte par les catalogues existants et assez active pour fournir 100–300 œuvres.
- Les auteurs indépendants acceptent volontiers de figurer dans le catalogue (promotion gratuite).
- Un cadence de parution lente justifie un usage hebdomadaire ou mensuel plutôt que quotidien.

## 7. Contraintes
- Développeur solo, profil data (SQL, modélisation, pipelines) ; front web peu pratiqué hors Vue.
- Coût nul pour le MVP ; démarrage en local.
- SEO obligatoire sur les fiches.
- Technologies durables, peu exotiques, reprise facile.
- Dépôt GitHub public, sans licence pour l'instant ; aucune donnée réelle ni secret dans le dépôt.
- Droits sur couvertures et synopsis à respecter : petites couvertures avec lien vers la page officielle, accord des auteurs indépendants, retrait sur demande sous 48 h.

## 8. Risques principaux
1. **Épuisement / dérive de périmètre** : web d'abord, stores en dernier, soumission minimale, critère de réussite personnel (O1).
2. **Saisie du catalogue** : tout repose sur une personne → tableur puis interface admin, soumission pour déléguer, auteurs qui maintiennent leur fiche, créneaux de revue fixes.
3. **Sur-ingénierie** : pile minimale (PostgreSQL + API + Nuxt), local d'abord, décisions tracées en ADR.
4. **Droits** sur couvertures et textes : consentement, retrait sous 48 h.

## 9. Jalons
0 Documentation · 1 Socle (base, API, import) · 2 Web et suivi (objectif O1 : je remplace mes notes) · 3 Ouverture (soumission, mise en ligne) · 4 Mobile (PWA, puis stores si besoin). Le détail vit dans GitHub Issues.

## 10. Décisions structurantes
Tracées dans [architecture.md](architecture.md) et [adr/](adr/).
