# Spécifications fonctionnelles (MVP)

> Statut : brouillon v0.1 — 2026-10-09 — les points « à trancher » sont listés en section 4

Rôles : **Visiteur** (non connecté), **Utilisateur** (connecté via Google), **Administrateur**. Le vocabulaire est défini en section 6 (glossaire), les données dans le [modèle](modele-de-donnees.md).

## 1. User stories et critères d'acceptation

### Découverte
**US-15 — Consulter l'accueil** (visiteur, utilisateur)
- Blocs : hero avec recherche ; « À la une » (carrousel de 3 œuvres « populaires cette semaine ») ; récemment ajoutées ; mieux notées (seuil RG-04) ; « Une œuvre manque à Trame ? » (lien vers US-09).
- **Deux accueils selon la connexion.** Visiteur : hero (titre, tampons de formats non cliquables, recherche) et panneau « Pourquoi Trame ? » (trois engagements) avec le bouton « Créer ma liste de lecture ». Connecté : pas de panneau ; hero « Bon retour, @handle » avec la recherche et une bande « Reprendre la lecture » (œuvres en cours, bouton +1, lien « Voir ma liste »). Si la liste est vide, un message d'accueil remplace la bande, avec les formats cliquables.
- **Explorer** n'est pas un bloc de la page : c'est un bouton de l'en-tête de toutes les pages (masqué sur la page de recherche). Il ouvre une fenêtre avec les formats puis les genres, **avec le nombre d'œuvres**, et un lien « Voir tout le catalogue ». Seuls les formats et genres qui ont au moins une œuvre sont affichés. Au mobile, le menu ☰ ne contient qu'Explorer.
- « Populaire cette semaine » : œuvres les plus ajoutées à une liste sur les 7 derniers jours, avec au moins 3 ajouts ; les 3 premières sont affichées.
- Le carrousel n'a pas de défilement automatique et reste utilisable au clavier. Mise en avant éditoriale ou sponsorisée : hors MVP.

**US-01 — Rechercher une œuvre** (visiteur, utilisateur)
- Une zone de recherche est accessible depuis toutes les pages : au bureau, le champ de l'en-tête a une largeur limitée ; au mobile, une icône l'ouvre sur toute la largeur (la recherche et le menu ☰ ne sont jamais ouverts ensemble).
- La recherche porte sur titre (et titres alternatifs), auteur, éditeur/plateforme ; elle est insensible à la casse et aux accents et tolère une faute de frappe légère.
- Les résultats apparaissent pendant la saisie à partir de 2 caractères, avec couverture, titre, type, auteur principal.
- Chaque mot saisi doit correspondre à un titre, un auteur, un éditeur, un format ou un genre (« aube manga » trouve Aube Fictive). Sans résultat complet, les œuvres qui contiennent au moins un mot sont proposées, avec une mention « résultats approchants ».
- La page de résultats sans texte de recherche liste le catalogue, des plus récemment ajoutées aux plus anciennes.
- Appuyer sur Entrée (ou « Voir les N résultats ») ouvre la page de résultats : liste paginée par 20, nombre total, filtres Type, Format, Genre, Statut de publication et Langue originale avec le nombre d'œuvres par valeur, tri (pertinence, titre A → Z, plus récentes).
- Un filtre accepte plusieurs valeurs (« en cours » ou « en pause ») ; les valeurs d'un même filtre s'additionnent (OU), sauf les genres où chaque genre choisi doit être présent (ET : « fantasy » et « humour ») ; les filtres entre eux se combinent. Un groupe sans valeur pour la recherche en cours n'est pas affiché.
- L'URL de la page porte la recherche, les filtres, le tri et la page : elle se partage et n'est pas indexée par les moteurs.
- Chaque résultat indique la langue d'origine (« FR : titre ») quand elle diffère de la langue de l'interface.
- Au mobile, les filtres s'ouvrent dans une feuille basse ; « Filtres (n) » reste à droite, les filtres actifs sont des pastilles retirables.
- Sans résultat : message clair et lien « Proposer cette œuvre » (US-09) ; le lien est inactif tant que US-09 n'existe pas.
- Les œuvres archivées n'apparaissent jamais.

**US-02 — Consulter une fiche œuvre**
- L'URL est `/work/{id}-{slug}` (`/en/work/…` en anglais : le préfixe de langue seul change) ; seul `{id}` est lu ; un slug erroné redirige vers l'URL canonique.
- La fiche affiche : couverture, titre (dans la langue de l'interface si disponible, sinon le titre original), titres alternatifs avec leur langue, langue originale, type, statut de publication, synopsis (avec sa langue et sa source, un synopsis traduit automatiquement est signalé), nombre de chapitres et de tomes (« ? » tant que l'œuvre est en cours), auteurs (avec rôle), éditeurs/plateformes, genres, liens « lire » et « acheter », œuvres liées regroupées par type de relation, nombre de membres qui l'ont dans leur liste (profils privés inclus, toujours affiché, « Membres 0 » compris ; décompte par statut hors MVP), note moyenne à partir de 10 notes (RG-04).
- Connecté, la fiche montre mon entrée de liste (statut, compteurs, note, dates de début et de fin) et permet de l'ajouter ou la modifier.
- La page est rendue côté serveur avec titre, description, balisage structuré et balises de partage.

**US-03 — Consulter une page auteur et une page éditeur/plateforme**
- Liste des œuvres liées, liens externes de l'auteur (sites et réseaux, en icônes, repliés au-delà de 3 personnes sur une fiche œuvre), nombre d'œuvres.

### Compte
**US-04 — Se connecter avec Google**
- Connexion en un clic ; un compte déjà connu est connecté directement et revient à la page où il se trouvait (langue comprise).
- À la première connexion, **aucun compte n'est créé tant que le handle n'est pas choisi** : l'utilisateur a 10 minutes. S'il abandonne ou laisse expirer, rien n'est enregistré et il peut recommencer.
- Handle : 3 à 30 caractères (lettres, chiffres, `_` et `-`), casse choisie conservée (« Ryan »), unique sans tenir compte de la casse ; les mots réservés et offensants sont refusés sans en donner la raison.
- Aucun mot de passe stocké ; seuls l'e-mail et l'identifiant Google sont conservés (jamais le nom Google). Session en cookie `httpOnly`, 30 jours, prolongée à chaque visite.
- Le changement de pseudo après la première connexion est traité à part (#105).

**US-12 — Supprimer mon compte**
- Bouton dans le profil avec confirmation ; supprime l'identité et la liste de lecture (voir exigences non fonctionnelles, RGPD).

### Suivi
**US-05 — Ajouter une œuvre à ma liste**
- Depuis une fiche ou la recherche, choix du statut (En cours, Terminé, À lire, En pause, Abandonné).
- Une seule entrée par couple (utilisateur, œuvre).
- Chaque statut a une couleur propre, toujours accompagnée de son libellé.

**US-06 — Mettre à jour ma progression**
- Compteurs **chapitres lus** et **tomes lus** modifiables indépendamment (saisie directe et boutons +1 / −1).
- Aucune validation croisée entre les deux compteurs ; un avertissement discret (non bloquant) si une valeur dépasse le nombre connu de chapitres/tomes parus.
- Note de 1 à 10, facultative et retirable.
- Les dates de début et de fin sont proposées automatiquement lors des changements de statut vers En cours / Terminé, et modifiables.
- Un seul composant « fiche de lecture » (statut, chapitres lus, tomes lus, note, dates, retirer de ma liste), réutilisé sur la fiche œuvre et dans la liste.

**US-07 — Consulter ma liste de lecture**
- Filtre par statut, tri (dernière mise à jour, titre, note), recherche dans ma liste ; bascule Liste / Grille.
- Chargement continu par pages de 50 (`pageSize` ≤ 50).
- Les totaux « chapitres lus » et « tomes lus » sont affichés séparément, jamais additionnés.
- Une œuvre archivée disparaît de la liste mais l'entrée est conservée ; elle réapparaît si l'œuvre est restaurée.

**US-08 — Profil public**
- URL `/u/{handle}` ; affiche les statistiques séparées (œuvres suivies, note moyenne donnée, répartition par statut), les œuvres les mieux notées et les dernières mises à jour (journal de lecture).
- Un lien mène à la page « Ma liste de lecture » : même page que US-07, en lecture seule pour un tiers et uniquement avec les entrées publiques.
- Le profil est **public par défaut** ; l'utilisateur peut le passer en privé à tout moment.
- Le menu du compte (« @handle ») propose un lien de partage de son propre profil. Trouver et consulter le profil d'un autre membre (recherche de membres, page communauté) est hors MVP.

### Contribution
**US-09 — Proposer une œuvre manquante** (utilisateur)
- Formulaire : titre, type, auteur(s), éditeur/plateforme (facultatif), langue originale, au moins un lien **ou** une couverture, synopsis (facultatif, dans la langue originale).
- À la saisie du titre, une liste « c'est l'une de ces œuvres ? » évite les doublons.
- La soumission est créée en attente ; l'utilisateur voit son état (en attente / acceptée / refusée).
- Facultatif : un ou plusieurs liens avec une œuvre existante (type de relation : suite, préquelle, spin-off, même univers, contient ; RG-17).
- Limite de fréquence pour les nouveaux comptes.

**US-13 — Signaler un contenu** (utilisateur) : bouton « Signaler » sur une fiche ; le signalement est transmis à l'administrateur.

### Administration
**US-10 — Traiter les soumissions** (administrateur) : liste triée par complétude, comparaison avec les doublons candidats, actions Corriger, Accepter (crée un **brouillon** de fiche, éditable avant publication) / Refuser (avec motif court ; pour un doublon, l'œuvre dupliquée est indiquée). Les corrections avant décision sont historisées (qui, quand, avant/après).

**US-11 — Gérer le catalogue** (administrateur) : créer, modifier, archiver et restaurer une œuvre, une personne, un éditeur/plateforme ; gérer relations, genres, liens et couvertures ; consulter les archives. Archiver une personne ou un éditeur/plateforme encore lié à des œuvres non archivées est refusé (`PERSON_HAS_WORKS`, `PUBLISHER_HAS_WORKS`) tant que les liens ne sont pas retirés.

**US-14 — Demander le retrait d'un contenu** (auteur, éditeur ou tout visiteur) : page de contact dédiée ; objectif de traitement sous 48 h.

## 2. Règles de gestion
| Réf | Règle |
|---|---|
| RG-01 | Une entrée de liste est unique par (utilisateur, œuvre). |
| RG-02 | Les compteurs sont des entiers ≥ 0 et **indépendants** : aucune règle de cohérence entre chapitres et tomes. |
| RG-03 | Aucune statistique n'additionne chapitres et tomes. |
| RG-04 | La note est un entier de 1 à 10, facultatif. La note moyenne d'une œuvre n'est affichée qu'à partir de **10 notes** pour éviter les moyennes non significatives ; en dessous, seul le nombre de notes est indiqué. |
| RG-05 | Une « saison 2 » d'un webcomic reste la **même fiche** (les chapitres continuent). Une série clairement distincte reçoit sa propre fiche, reliée par une relation. |
| RG-06 | Un recueil est une fiche de type `anthology` reliée aux œuvres incluses par la relation `contains`. |
| RG-07 | Une œuvre publiée en ligne puis éditée en papier reste **une seule fiche** (ex. Les Veilleurs du Phare) : `chapters` pour la partie en ligne, `volumes` pour le papier. |
| RG-08 | Dédoublonnage sans ISBN : titre normalisé + recherche floue, proposé à l'utilisateur et vérifié par l'administrateur. |
| RG-09 | Toute suppression est un archivage, réservé à l'administrateur ; une fiche archivée disparaît des listes et de la recherche publique mais reste restaurable. |
| RG-10 | Un doublon accepté par erreur est archivé (pas de fusion dans le MVP) ; ses membres retrouvent l'œuvre conservée par la recherche. |
| RG-11 | Les liens externes sont en `https://`. |
| RG-12 | Les œuvres pour adultes ne sont **pas référencées** dans le MVP (hors périmètre) ; l'administrateur refuse leur soumission. Pas de champ « public » ni de gestion d'âge. |
| RG-14 | Chapitres et tomes sont des **entiers**. Les chapitres intermédiaires (10.5), postfaces et bonus ne sont pas comptés (ex. 92 épisodes, postface exclue). |
| RG-15 | Seules les parutions **déjà sorties** sont renseignées ; Trame n'est pas un calendrier de sorties (voir MangaCollec). |
| RG-16 | Un hors-série qui paraît aussi dans un recueil reste **une seule fiche**, reliée au recueil (`contains`) et à la série d'origine (`spin_off`). |
| RG-17 | Deux œuvres sont reliées par **une seule relation principale** (ex. `spin_off` pour Marées Rouges – Avant la Digue, même s'il est aussi une préquelle) ; la chronologie se précise dans le synopsis. |
| RG-18 | Tant qu'une œuvre est **en cours**, ses totaux (`chapters`, `volumes`) restent **vides** et s'affichent « ? » (ex. « chapitres 100/? · tomes 12/? »). Ils sont renseignés quand l'œuvre est terminée. Aucun avertissement de dépassement n'est affiché quand le total est inconnu. |
| RG-13 | La couverture n'est affichée que si `cover_consent` est vrai ou si l'administrateur l'a explicitement validée. |
| RG-19 | Une œuvre a une **langue originale** obligatoire. Elle est visible et suivable par tout utilisateur, quelle que soit la langue de l'interface ; aucune disponibilité par pays n'est calculée (ADR 0007). |
| RG-20 | Le **titre** affiché est celui de la langue de l'interface s'il existe, sinon le titre original. Les autres titres (traduit, international, ancien, court) restent recherchables. |
| RG-21 | Le **synopsis** affiché est celui de la langue de l'interface (officiel de préférence, puis saisi, puis automatique), sinon celui de la langue originale. Un synopsis traduit automatiquement est signalé comme tel. |

## 3. Cas limites
- **Les Veilleurs du Phare** : webtoon en ligne puis tomes papier chez Éditions du Phare → une fiche, deux éditeurs/plateformes, deux liens, `chapters` et `volumes`.
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
- Contenu multilingue (2026-10-12, ADR 0007, #53) : l'API accepte `lang` (liste de langues dans la configuration de l'API) ; sans `lang`, titre et synopsis sont dans la langue originale. Un titre `short` ou `former` n'est jamais choisi comme titre affiché mais reste recherchable.
- Connexion et pseudo (2026-10-20, #22) : compte créé seulement au choix du handle (attente de 10 minutes, sans trace en cas d'abandon) ; handle avec la casse choisie, unicité insensible à la casse, mots réservés et offensants refusés ; seuls l'e-mail et l'identifiant Google sont conservés.

## 5. Points encore ouverts
Décidés au démarrage du ticket concerné :
- Changement de pseudo : historique des anciens handles, redirection de l'ancien profil, limite de fréquence (#105).
- Export des données et visibilité des notes d'un profil public (#34).
- Soumission : règles de la limite de fréquence, motifs de refus et de signalement prédéfinis, preuve du retrait (#31, #32, #33).
- Le proposant voit-il le motif de refus et peut-il le contester ? (#32).
- Textes légaux (#35).

Le reste relève de choix techniques, traités en ADR au démarrage du code.

## 6. Glossaire
Vocabulaire fonctionnel en français ; noms techniques (tables, colonnes) en anglais, détaillés dans le [modèle de données](modele-de-donnees.md).

| Terme | Définition | Nom technique |
|---|---|---|
| **Œuvre / fiche** | Un titre du catalogue ; une œuvre = une fiche, quel que soit le nombre de supports | `work` |
| **Type** | Structure de l'histoire : **série**, **one-shot**, **anthologie** (recueil d'histoires, d'un ou plusieurs auteurs). Indépendant du format et du genre | `work.type` (`series`, `oneshot`, `anthology`) |
| **Format** | Tradition ou mode de publication et de lecture : manga, manhwa, BD, webtoon (défilement vertical), webcomic… Plusieurs par œuvre | `genre` (`category = format`), `work_genre` |
| **Genre** | Thème de l'œuvre : fantasy, humour, science-fiction… Plusieurs par œuvre | `genre` (`category = theme`), `work_genre` |
| **Chapitre / épisode** | Unité de lecture en ligne ou en prépublication | `work.chapters`, `library_entry.chapters_read` |
| **Tome / volume** | Unité de lecture papier reliée | `work.volumes`, `library_entry.volumes_read` |
| **Statut de publication** | À venir, en cours, terminée, en pause, abandonnée | `work.status` |
| **Auteur / crédit** | Personne ou collectif lié à une œuvre avec un rôle (scénario, dessin, couleur, autre) | `person`, `work_credit` |
| **Éditeur / plateforme** | Maison d'édition, plateforme de lecture (ex. Webtoon) ou auto-édition | `publisher` |
| **Relation** | Lien entre deux œuvres (suite, préquelle, spin-off, même univers, contient…) | `work_relation` |
| **Archiver** | Retirer une fiche des listes sans la détruire (admin) ; restaurable | `deleted_at`, `deleted_by` |
| **Liste / entrée** | « Ma liste » : l'ensemble des œuvres suivies par un utilisateur ; une entrée est le suivi d'une œuvre (statut de lecture, compteurs, note, dates) | `library_entry` |
| **Compteurs** | « Chapitres lus » et « tomes lus », **indépendants** : jamais mappés ni additionnés | `chapters_read`, `volumes_read` |
| **Journal de lecture** | Historique en ajout seul des progressions | `reading_event` |
| **Soumission** | Proposition d'œuvre par un utilisateur, en attente de décision de l'administrateur | `submission` |
| **Handle** | Identifiant public unique, utilisé dans l'URL du profil | `app_user.handle` |
