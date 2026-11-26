# Web — Annonces (toasts)

> Règles des annonces affichées en bas de l'écran. Le composant (`UiToasts`, `UiToastItem`) est décrit dans [composants](composants.md) ; les textes de chaque écran sont dans le document de l'écran.

## Échecs d'écriture

Deux cas, selon que rejouer peut aboutir (`describeWriteFailure`, `utils/write-errors.ts`) :
- **Panne du serveur ou du réseau** (`INTERNAL_ERROR`, `RATE_LIMITED`) : notification d'erreur avec « Réessayer », qui rejoue l'écriture, message général puis « Réessaie dans un instant. » sur la 2e ligne. Point d'entrée unique : `useWriteFailure()(cause, { retry, messageKey, startedFrom })`, qui n'ajoute « Réessayer » et le conseil que pour ces deux codes (`useOptimisticWrite`, `useLibraryEntry`, profil, administration via `useAdminFailure`). Ce toast se ferme quand on change de page (`UiToasts` ferme tout toast qui porte un bouton au changement de chemin) : on ne rejoue jamais une écriture d'un écran quitté. Un échec qui arrive après avoir quitté la page s'annonce sans « Réessayer » (`useWriteFailure` compare le chemin du départ à celui de l'échec).
- **Refus qu'il faut corriger ou qui ne passera pas** (champ invalide, fiche modifiée entre-temps, référence en brouillon ou archivée, session expirée, œuvre retirée…) : jamais de « Réessayer ». Rejouer redonnerait le même refus. Dans l'administration, le message qui dit quoi faire s'affiche dans le formulaire (`UiFormError`), comme les contrôles faits avant l'envoi ; ailleurs, `showWriteFailure` affiche un toast avec le message seul.

## Réussites, annulation et information

- **Quand** : une réussite s'annonce (toast vert) quand l'action n'a pas de trace visible à l'écran ou qu'elle est destructrice ; pas pour un changement déjà visible (statut, compteur). L'information (jaune) est réservée à un état qui dure : « Hors connexion ».
- **Une écriture à effet immédiat** passe son annonce à `useOptimisticWrite` (`announce` : une clé de message, ou une clé avec « Annuler ») : elle n'apparaît qu'une fois le serveur d'accord, jamais avant un échec.
- **« Annuler »** (`Toast.action.kind = 'undo'`) est lui-même une écriture : le toast se ferme au clic, puis l'échec passe par `useWriteFailure` (« Réessayer » seulement après une panne du serveur ou du réseau). Comme « Réessayer », il se ferme au changement de page (de chemin, pas de filtre) : l'annulation appartient à l'écran qui l'a proposé. Après un archivage depuis la fiche, l'annonce est donc créée une fois la navigation faite, et `useWriteFailure` reçoit la page du clic (`startedFrom`).
- **Ajout depuis la recherche** (direct, ou rejoué après connexion) : toast « Œuvre ajoutée à ta liste. » avec « Annuler », qui supprime l'entrée tout juste créée (rien à restaurer) ; le bouton « Ajouter » disparaît, ce qui ne suffit pas à confirmer l'ajout.
- **Retrait de Ma liste** : « Annuler » renvoie l'entrée avec `restored: true` ; l'API la remet telle quelle, sans date proposée ni ligne de journal (le retrait garde le journal).
- **Durée** : 5 s, 10 s pour une erreur. Seul un toast durable (`isSticky` : « Hors connexion », retiré au retour du réseau) ne se ferme jamais seul et n'a pas de barre de décompte. « Annuler » suit la règle commune. La minuterie se met en pause au survol (souris) et tant que le focus est dans l'annonce : un utilisateur au clavier qui y arrive a tout le temps voulu.
- **Lecteurs d'écran** : la pile est une zone `aria-live="polite"` toujours présente ; seule une erreur a `role="alert"`. La pile est placée après `<main>` dans le layout, comme elle l'est à l'écran, et le bouton d'une annonce atteint 44 px au doigt.
