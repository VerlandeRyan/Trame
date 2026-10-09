# ADR 0003 — Mobile : web + PWA d'abord, stores ensuite

- **Statut** : accepté
- **Date** : 2026-10-09

## Contexte
La cible initiale mentionnait web, iOS et Android. Un wrapper (Capacitor) expose à la règle 4.2 d'Apple (une app doit apporter plus qu'un site « emballé »), à des frais de compte développeur (Apple 99 $/an, Google Play 25 $ une fois — à vérifier) et à 15–25 % de temps supplémentaire (WebView, gestes, connexion Google par lien profond, notifications, revues des stores). Le projet est personnel, sans budget ni audience au départ.

## Décision
1. **Web + PWA** (installable sur l'écran d'accueil), gratuit : on commence ici.
2. Éventuellement **Android** (Play Store).
3. Éventuellement **iOS via Capacitor**, seulement après un moment d'usage de la PWA et avec de vraies fonctions natives (partage, notifications, liens profonds, bibliothèque hors ligne). Ne jamais faire pointer l'application vers le site distant.
4. Plan B si refus d'Apple : iPhone en PWA, ou application native (Expo/React Native) sur la **même API**.

## Alternatives
Capacitor dès le début ; React Native/Expo ; Flutter (écarté : SEO web).

## Conséquences
+ Aucun coût ni risque de refus au départ ; l'API indépendante rend le choix réversible.
− Notifications push limitées sur iPhone tant que le site n'est pas installé (à vérifier) ; pas de présence dans les stores au début.
