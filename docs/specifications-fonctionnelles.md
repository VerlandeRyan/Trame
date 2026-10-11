# Spécifications fonctionnelles (MVP)

> Statut : brouillon v0.1 — 2026-10-09 — les points « à trancher » sont listés en section 4

Rôles : **Visiteur** (non connecté), **Utilisateur** (connecté via Google), **Administrateur**. Le vocabulaire est défini en section 6 (glossaire), les données dans le [modèle](modele-de-donnees.md).

## 1. User stories et critères d'acceptation

### Découverte
**US-01 — Rechercher une œuvre** (visiteur, utilisateur)
- Une zone de recherche est accessible depuis toutes les pages.
- La recherche porte sur titre (et titres alternatifs), auteur, éditeur/plateforme ; elle est insensible à la casse et aux accents et tolère une faute de frappe légère.
- Les résultats apparaissent pendant la saisie à partir de 2 caractères, avec couverture, titre, type, auteur principal.
- Sans résultat : message clair et lien « Proposer cette œuvre » (US-09).
- Les œuvres archivées n'apparaissent jamais.

**US-02 — Consulter une fiche œuvre**
- L'URL est `/oeuvre/{id}-{slug}` ; seul `{id}` est lu ; un slug erroné redirige vers l'URL canonique.
- La fiche affiche : couverture, titre, titres alternatifs, type, statut de publication, synopsis, nombre de chapitres et de tomes (« ? » tant que l'œuvre est en cours), auteurs (avec rôle), éditeurs/plateformes, genres, liens « lire » et « acheter », œuvres liées regroupées par type de relation.
- Connecté, la fiche montre mon entrée de bibliothèque et permet de l'ajouter ou la modifier.
- La page est rendue côté serveur avec titre, description, balisage structuré et balises de partage.

**US-03 — Consulter une page auteur et une page éditeur/plateforme**
- Liste des œuvres liées, liens externes de l'auteur, nombre d'œuvres.

### Compte
**US-04 — Se connecter avec Google**
- Connexion en un clic ; à la première connexion, choix d'un handle (validé : unicité, format, mots réservés).
- Aucun mot de passe stocké ; session en cookie `httpOnly`.

**US-12 — Supprimer mon compte**
- Bouton dans le profil avec confirmation ; supprime l'identité et la bibliothèque (voir exigences non fonctionnelles, RGPD).

### Suivi
**US-05 — Ajouter une œuvre à ma bibliothèque**
- Depuis une fiche ou la recherche, choix du statut (En cours, Terminé, À lire, En pause, Abandonné).
- Une seule entrée par couple (utilisateur, œuvre).

**US-06 — Mettre à jour ma progression**
- Compteurs **chapitres lus** et **tomes lus** modifiables indépendamment (saisie directe et boutons +1 / −1).
- Aucune validation croisée entre les deux compteurs ; un avertissement discret (non bloquant) si une valeur dépasse le nombre connu de chapitres/tomes parus.
- Note de 1 à 10, facultative et retirable.
- Les dates de début et de fin sont proposées automatiquement lors des changements de statut vers En cours / Terminé, et modifiables.

**US-07 — Consulter ma bibliothèque**
- Filtre par statut, tri (dernière mise à jour, titre, note), recherche dans ma bibliothèque.
- Les totaux « chapitres lus » et « tomes lus » sont affichés séparément, jamais additionnés.

**US-08 — Profil public**
- URL `/u/{handle}` ; affiche les entrées publiques, les statistiques séparées et les œuvres les mieux notées.
- Le profil est **public par défaut** ; l'utilisateur peut le passer en privé à tout moment.

### Contribution
**US-09 — Proposer une œuvre manquante** (utilisateur)
- Formulaire : titre, type, auteur(s), éditeur/plateforme (facultatif), au moins un lien **ou** une couverture, synopsis (facultatif).
- À la saisie du titre, une liste « c'est l'une de ces œuvres ? » évite les doublons.
- La soumission est créée en attente ; l'utilisateur voit son état (en attente / acceptée / refusée).
- Limite de fréquence pour les nouveaux comptes.

**US-13 — Signaler un contenu** (utilisateur) : bouton « Signaler » sur une fiche ; le signalement est transmis à l'administrateur.

### Administration
**US-10 — Traiter les soumissions** (administrateur) : liste triée par complétude, comparaison avec les doublons candidats, actions Accepter (crée la fiche, éditable avant publication) / Refuser (avec motif court).

**US-11 — Gérer le catalogue** (administrateur) : créer, modifier, archiver et restaurer une œuvre, une personne, un éditeur/plateforme ; gérer relations, genres, liens et couvertures ; consulter les archives.

**US-14 — Demander le retrait d'un contenu** (auteur, éditeur ou tout visiteur) : page de contact dédiée ; objectif de traitement sous 48 h.

## 2. Règles de gestion
| Réf | Règle |
|---|---|
| RG-01 | Une entrée de bibliothèque est unique par (utilisateur, œuvre). |
| RG-02 | Les compteurs sont des entiers ≥ 0 et **indépendants** : aucune règle de cohérence entre chapitres et tomes. |
| RG-03 | Aucune statistique n'additionne chapitres et tomes. |
| RG-04 | La note est un entier de 1 à 10, facultatif. La note moyenne d'une œuvre n'est affichée qu'à partir de **10 notes** pour éviter les moyennes non significatives ; en dessous, seul le nombre de notes est indiqué. |
| RG-05 | Une « saison 2 » d'un webcomic reste la **même fiche** (les chapitres continuent). Une série clairement distincte reçoit sa propre fiche, reliée par une relation. |
| RG-06 | Un recueil est une fiche de type `collection` reliée aux œuvres incluses par la relation `contains`. |
| RG-07 | Une œuvre publiée en ligne puis éditée en papier reste **une seule fiche** (ex. BICLY) : `chapters` pour la partie en ligne, `volumes` pour le papier. |
| RG-08 | Dédoublonnage sans ISBN : titre normalisé + recherche floue, proposé à l'utilisateur et vérifié par l'administrateur. |
| RG-09 | Toute suppression est un archivage, réservé à l'administrateur ; une fiche archivée disparaît des listes et de la recherche publique mais reste restaurable. |
| RG-10 | Un doublon accepté par erreur est archivé (pas de fusion dans le MVP). |
| RG-11 | Les liens externes sont en `https://`. |
| RG-12 | Les œuvres pour adultes ne sont **pas référencées** dans le MVP (hors périmètre) ; l'administrateur refuse leur soumission. Pas de champ « public » ni de gestion d'âge. |
| RG-14 | Chapitres et tomes sont des **entiers**. Les chapitres intermédiaires (10.5), postfaces et bonus ne sont pas comptés (ex. BICLY = 158 épisodes, postface exclue). |
| RG-15 | Seules les parutions **déjà sorties** sont renseignées ; Trame n'est pas un calendrier de sorties (voir MangaCollec). |
| RG-16 | Un hors-série qui paraît aussi dans un recueil reste **une seule fiche**, reliée au recueil (`contains`) et à la série d'origine (`spin_off`). |
| RG-17 | Deux œuvres sont reliées par **une seule relation principale** (ex. `spin_off` pour Fabula Fantasia, même s'il est aussi une préquelle) ; la chronologie se précise dans le synopsis. |
| RG-18 | Tant qu'une œuvre est **en cours**, ses totaux (`chapters`, `volumes`) restent **vides** et s'affichent « ? » (ex. « chapitres 100/? · tomes 12/? »). Ils sont renseignés quand l'œuvre est terminée. Aucun avertissement de dépassement n'est affiché quand le total est inconnu. |
| RG-13 | La couverture n'est affichée que si `cover_consent` est vrai ou si l'administrateur l'a explicitement validée. |
| RG-19 | Une œuvre a une **langue originale** obligatoire. Elle est visible et suivable par tout utilisateur, quelle que soit la langue de l'interface ; aucune disponibilité par pays n'est calculée (ADR 0007). |
| RG-20 | Le **titre** affiché est celui de la langue de l'interface s'il existe, sinon le titre original. Les autres titres (traduit, international, ancien, court) restent recherchables. |
| RG-21 | Le **synopsis** affiché est celui de la langue de l'interface (officiel de préférence, puis saisi, puis automatique), sinon celui de la langue originale. Un synopsis traduit automatiquement est signalé comme tel. |

## 3. Cas limites
- **BICLY** : webtoon en ligne puis tomes papier chez Vega → une fiche, deux éditeurs/plateformes, deux liens, `chapters` et `volumes`.
- **Lecteur qui a lu la version en ligne puis acheté le tome 1** : `chapters_read = 40`, `volumes_read = 1` — aucune incohérence.
- **Œuvre sans éditeur ni couverture** : valide si au moins un lien existe.
- **Titre qui change** : l'URL reste valide (seul l'`id` compte).
- **Recueil dont une œuvre est archivée** : la relation reste mais l'œuvre archivée n'est pas affichée.
- **Pseudonymes** : une `person` par nom d'usage au départ ; une table d'alias sera ajoutée seulement si le besoin apparaît.

## 4. Décisions produit prises (2026-10-09)
- Profil **public par défaut** (handle seulement, jamais l'e-mail), avec un interrupteur « privé ».
- Note moyenne affichée à partir de **10 notes**.
- **Pas d'œuvres pour adultes** dans le MVP : pas de champ « public », pas de floutage ni de confirmation d'âge. Priorité à la facilité d'accès des œuvres populaires et indépendantes.
- Journal de lecture (`reading_event`) **dans le MVP**.
- Pseudonymes : une `person` par nom d'usage ; alias plus tard si besoin.

## 5. Points encore ouverts
Aucun point produit. Restent des choix techniques, traités en ADR au démarrage du code.

## 6. Glossaire
Vocabulaire fonctionnel en français ; noms techniques (tables, colonnes) en anglais, détaillés dans le [modèle de données](modele-de-donnees.md).

| Terme | Définition | Nom technique |
|---|---|---|
| **Œuvre / fiche** | Un titre du catalogue ; une œuvre = une fiche, quel que soit le nombre de supports | `work` |
| **Type** | Format d'origine : **série**, **one-shot**, **webcomic/webtoon**, **recueil** | `work.type` (`series`, `oneshot`, `webcomic`, `collection`) |
| **Chapitre / épisode** | Unité de lecture en ligne ou en prépublication | `work.chapters`, `library_entry.chapters_read` |
| **Tome / volume** | Unité de lecture papier reliée | `work.volumes`, `library_entry.volumes_read` |
| **Statut de publication** | À venir, en cours, terminée, en pause, abandonnée | `work.status` |
| **Auteur / crédit** | Personne ou collectif lié à une œuvre avec un rôle (scénario, dessin, couleur, autre) | `person`, `work_credit` |
| **Éditeur / plateforme** | Maison d'édition, plateforme de lecture (ex. Webtoon) ou auto-édition | `publisher` |
| **Relation** | Lien entre deux œuvres (suite, préquelle, spin-off, même univers, contient…) | `work_relation` |
| **Archiver** | Retirer une fiche des listes sans la détruire (admin) ; restaurable | `deleted_at`, `deleted_by` |
| **Bibliothèque / entrée** | Le suivi d'une œuvre par un utilisateur : statut de lecture, compteurs, note, dates | `library_entry` |
| **Compteurs** | « Chapitres lus » et « tomes lus », **indépendants** : jamais mappés ni additionnés | `chapters_read`, `volumes_read` |
| **Journal de lecture** | Historique en ajout seul des progressions | `reading_event` |
| **Soumission** | Proposition d'œuvre par un utilisateur, en attente de décision de l'administrateur | `submission` |
| **Handle** | Identifiant public unique, utilisé dans l'URL du profil | `app_user.handle` |
