# Modèle de données

> Statut : brouillon v0.1 — 2026-10-09 — base de travail, à valider par les jeux d'acceptation (section 7)

Modèle calqué sur MyAnimeList : une œuvre = une fiche, compteurs chapitres/tomes indépendants, pas de notion d'édition. SGBD : **PostgreSQL**. Conventions : tables et colonnes en `snake_case` anglais, clés `bigint generated always as identity`, dates en `timestamptz` (sauf dates calendaires en `date`), énumérations en `text` + `CHECK` (plus simples à migrer qu'un type `ENUM`), suppression douce par `deleted_at` / `deleted_by`.

## 1. Schéma entité-relation
```mermaid
erDiagram
  app_user ||--o{ library_entry : suit
  work ||--o{ library_entry : "est suivie dans"
  app_user ||--o{ reading_event : journalise
  work ||--o{ reading_event : concerne
  app_user ||--o{ submission : propose
  work ||--o{ work_title : "titres alternatifs"
  work ||--o{ work_synopsis : "synopsis par langue"
  work ||--o{ work_credit : "est créditée"
  person ||--o{ work_credit : réalise
  work ||--o{ work_publisher : "publiée par"
  publisher ||--o{ work_publisher : publie
  work ||--o{ work_genre : "classée"
  genre ||--o{ work_genre : classe
  work ||--o{ work_relation : "source"
  work ||--o{ work_relation : "cible"
  work ||--o{ external_link : "liens"
  person ||--o{ external_link : "liens"
```

## 2. Définition de chaque table
| Table | Définition (à quoi elle sert) | Clé | Qui l'alimente |
|---|---|---|---|
| `app_user` | Un compte utilisateur, créé à la première connexion Google. Porte l'identité publique (handle), le rôle (`user` / `admin`) et la visibilité du profil | `id` | L'utilisateur (connexion) ; l'admin pour le rôle |
| `work` | **Table centrale** : une œuvre du catalogue (série, one-shot ou anthologie), quel que soit le nombre de supports. Contient les informations de la fiche et la couverture | `id` | Admin (ou soumission acceptée) |
| `work_title` | Titres alternatifs d'une œuvre par langue (traduction, titre international, ancien titre, titre court) : affichage localisé et recherche | (`work_id`, `language`, `title`) | Admin |
| `work_synopsis` | Synopsis d'une œuvre dans une langue, avec sa source (officielle, humaine, automatique) | (`work_id`, `language`) | Admin |
| `work_relation` | Lien orienté entre deux œuvres : suite, préquelle, spin-off, histoire annexe, adaptation, version alternative, même univers, contient (anthologie), autre | (`work_id`, `related_work_id`, `relation`) | Admin |
| `person` | Un auteur ou un collectif (scénariste, dessinateur, coloriste…) sous le nom sous lequel il est crédité | `id` | Admin |
| `work_credit` | Association œuvre ↔ personne avec un **rôle** (scénario, dessin, couleur, autre). Une œuvre peut avoir plusieurs auteurs, une personne plusieurs œuvres | (`work_id`, `person_id`, `role`) | Admin |
| `publisher` | Une structure qui publie : maison d'édition (Éditions Pivoine, Atelier Cobalt…), plateforme de lecture (Webtoon, Mangadraft) ou entrée « auto-édition » | `id` | Admin |
| `work_publisher` | Association œuvre ↔ éditeur/plateforme. Une œuvre peut en avoir plusieurs (Les Veilleurs du Phare : plateforme + éditeur papier) ou aucun | (`work_id`, `publisher_id`) | Admin |
| `genre` | Étiquettes de classement (manga, BD, fantasy, humour…). Sert aux filtres, pas à la structure | `id` | Admin |
| `work_genre` | Association œuvre ↔ genre (plusieurs genres par œuvre) | (`work_id`, `genre_id`) | Admin |
| `external_link` | Un lien externe rattaché **soit** à une œuvre, **soit** à une personne : où lire, où acheter, site, réseau social | `id` | Admin |
| `library_entry` | **Le suivi d'une œuvre par un utilisateur** : statut de lecture, chapitres lus, tomes lus, note, dates. Une seule ligne par couple utilisateur/œuvre | (`user_id`, `work_id`) | L'utilisateur |
| `reading_event` | Journal en ajout seul des progressions de lecture, pour l'historique et le bilan annuel | `id` | L'API, automatiquement |
| `submission` | Une proposition d'œuvre faite par un utilisateur, en attente d'une décision de l'admin (contient les champs proposés en JSON) | `id` | L'utilisateur ; l'admin la traite |

**Lecture d'ensemble** : le **catalogue** (`work`, `person`, `publisher` et leurs tables d'association) est alimenté par l'administrateur ; la partie **utilisateur** (`app_user`, `library_entry`, `reading_event`) par les utilisateurs ; `submission` fait le pont entre les deux.

## 3. Dictionnaire de données

### `app_user`
| Colonne | Type | Contraintes / règle |
|---|---|---|
| id | bigint identity | PK |
| email | text | NOT NULL, unique (insensible à la casse) |
| google_sub | text | NOT NULL, unique — identifiant Google du compte |
| handle | citext | NOT NULL, unique, 3–30 car. `[a-z0-9_-]`, liste de mots réservés |
| display_name | text | nullable |
| role | text | NOT NULL, `user` \| `admin`, défaut `user` |
| profile_visibility | text | NOT NULL, `public` \| `private`, **défaut `public`** |
| created_at | timestamptz | NOT NULL, défaut `now()` |
| deleted_at | timestamptz | nullable (suppression de compte) |

### `work`
| Colonne | Type | Contraintes / règle |
|---|---|---|
| id | bigint identity | PK — identifiant interne (`trame_id`), fait foi dans l'URL |
| title | text | NOT NULL — titre dans la langue originale (`original_language`) |
| original_language | text | NOT NULL, **sans défaut**, code ISO 639 en minuscules (2 ou 3 lettres) — langue de repli du titre et du synopsis |
| type | text | NOT NULL, `series` \| `oneshot` \| `anthology` — structure de l'histoire ; le format (manga, webtoon, webcomic…) est dans `genre` |
| status | text | NOT NULL, `upcoming` \| `ongoing` \| `completed` \| `hiatus` \| `abandoned` |
| chapters | integer | nullable, ≥ 0 — nombre **total** de chapitres/épisodes ; **renseigné seulement quand l'œuvre est terminée** (NULL = inconnu / en cours, affiché « ? » comme sur MAL) |
| volumes | integer | nullable, ≥ 0 — nombre **total** de tomes ; même règle : NULL tant que l'œuvre est en cours, affiché « ? » |
| started_on | date | nullable |
| ended_on | date | nullable, ≥ started_on |
| cover_path | text | nullable — chemin dans le stockage d'images |
| cover_source_url | text | nullable — provenance de la couverture |
| cover_consent | boolean | NOT NULL, défaut false — accord de l'auteur/éditeur |
| created_at / updated_at | timestamptz | NOT NULL |
| published_at | timestamptz | nullable — NULL = brouillon (créé à l'acceptation d'une soumission), invisible du public ; distinct de `deleted_at` |
| deleted_at / deleted_by | timestamptz / bigint FK `app_user` | nullable — archivage |

Index : GIN trigram sur `title` (`pg_trgm` + `unaccent`) ; index sur `type`, `status`, `deleted_at`.

### `work_title`
| Colonne | Type | Règle |
|---|---|---|
| work_id | bigint FK `work` | NOT NULL, `ON DELETE CASCADE` |
| language | text | NOT NULL, code ISO 639 en minuscules |
| kind | text | NOT NULL, `translated` \| `international` \| `former` \| `short` |
| title | text | NOT NULL |

PK (`work_id`, `language`, `title`). Titres autres que `work.title`. Titre affiché pour une langue `L` : `translated`, sinon `international`, de langue `L` ; sinon `work.title` (`former` et `short` ne servent qu'à la recherche et à l'affichage de la fiche). Index GIN trigram sur `title`.

### `work_synopsis`
| Colonne | Type | Règle |
|---|---|---|
| work_id | bigint FK `work` | NOT NULL, `ON DELETE CASCADE` |
| language | text | NOT NULL, code ISO 639 en minuscules |
| text | text | NOT NULL, non vide |
| source | text | NOT NULL, `official` \| `human` \| `machine` |

PK (`work_id`, `language`). Lecture : langue demandée, sinon langue originale de l'œuvre, sinon aucun synopsis. Pas de synopsis traduit automatiquement tant que cet outil n'est pas décidé : `machine` est prévu, non produit.

### `work_relation`
| Colonne | Type | Règle |
|---|---|---|
| work_id | bigint FK `work` | NOT NULL — œuvre source |
| related_work_id | bigint FK `work` | NOT NULL, ≠ work_id |
| relation | text | NOT NULL, `sequel` \| `prequel` \| `spin_off` \| `side_story` \| `adaptation` \| `alternate_version` \| `shared_universe` \| `contains` \| `other` |
PK (`work_id`, `related_work_id`, `relation`). Un seul sens est stocké ; l'inverse (sequel ↔ prequel, contains ↔ fait partie de, spin_off ↔ a pour spin-off) est déduit à l'affichage. **Lecture : « `work_id` — relation — `related_work_id` »**, par exemple « Marées Rouges – Avant la Digue — `spin_off` — Marées Rouges » ou « Le Cartographe de Sel, le Recueil — `contains` — Escale ». Par défaut, une seule relation principale par paire d'œuvres.

### `person`
`id` PK, `name` text NOT NULL (pseudonyme ou nom d'usage), `kind` text `person` \| `collective` (défaut `person`), `deleted_at`. Pas d'e-mail ni de donnée privée.

### `work_credit`
`work_id`, `person_id`, `role` (`story` \| `art` \| `colors` \| `other`). PK (`work_id`, `person_id`, `role`).

### `publisher`
`id` PK, `name` text NOT NULL, `kind` text `publisher` \| `platform` \| `self_published`, `url` nullable, `deleted_at`.

### `work_publisher`
`work_id`, `publisher_id`. PK composite. Facultatif : une œuvre peut n'avoir aucun éditeur (auto-édition sans structure).

### `genre` / `work_genre`
`genre(id, code unique, category)` : la liste des étiquettes qui existent. `code` est un slug stable en anglais (`manhwa`, `fantasy`…), jamais un texte traduit ; `category` vaut `format` (tradition ou mode de publication : manga, manhwa, bd, webtoon, webcomic) ou `theme` (fantasy, humor, science_fiction…). `work_genre(work_id, genre_id)` : quelles étiquettes porte chaque œuvre, plusieurs de chaque catégorie. Ajouter une valeur (ex. `manhua`) est une ligne de données, sans migration.

### `external_link`
| Colonne | Type | Règle |
|---|---|---|
| id | bigint identity | PK |
| work_id | bigint FK nullable | exactement l'un de `work_id` / `person_id` est renseigné (`CHECK`) |
| person_id | bigint FK nullable | idem |
| kind | text | `read` \| `buy` \| `website` \| `social` |
| url | text | NOT NULL, `https://` uniquement (`CHECK`) |
| label | text | nullable |

### `library_entry`
| Colonne | Type | Règle |
|---|---|---|
| user_id | bigint FK `app_user` | NOT NULL |
| work_id | bigint FK `work` | NOT NULL |
| status | text | NOT NULL, `reading` \| `completed` \| `plan_to_read` \| `on_hold` \| `dropped` |
| chapters_read | integer | NOT NULL, défaut 0, `CHECK >= 0` |
| volumes_read | integer | NOT NULL, défaut 0, `CHECK >= 0` |
| rating | smallint | nullable, `CHECK BETWEEN 1 AND 10` |
| started_on / finished_on | date | nullable |
| updated_at | timestamptz | NOT NULL |
PK (`user_id`, `work_id`). **Aucune contrainte de cohérence entre `chapters_read` et `volumes_read`** (choix assumé : les deux unités ne sont jamais mappées).

### `reading_event`
| Colonne | Type | Règle |
|---|---|---|
| id | bigint identity | PK |
| user_id / work_id | bigint FK | NOT NULL |
| kind | text | NOT NULL, `chapters` \| `volumes` \| `status` \| `rating` — ce qui a changé |
| chapters_added | integer | chapitres lus en plus ; renseigné seulement si `kind = chapters` |
| volumes_added | integer | tomes lus en plus ; renseigné seulement si `kind = volumes` |
| new_status | text | statut de lecture atteint (mêmes valeurs que `library_entry.status`) ; seulement si `kind = status` |
| new_rating | smallint | note donnée, 1 à 10 ; seulement si `kind = rating` |
| occurred_at | timestamptz | NOT NULL, défaut `now()` |

Une `CHECK` impose qu'une seule colonne de valeur soit renseignée, celle qui correspond au `kind`. Table en ajout seul, alimentée côté API ; sert à l'historique et au bilan annuel (somme de `chapters_added` / `volumes_added`).

### `submission`
`id` PK, `payload` jsonb NOT NULL (champs proposés), `status` (`pending` \| `accepted` \| `rejected`), `submitted_by` FK, `reviewed_by` FK nullable, `dedupe_candidates` jsonb nullable, `created_at`, `reviewed_at`.

### `submission_revision`
`id` PK, `submission_id` FK `submission` (`ON DELETE CASCADE`), `revised_by` FK `app_user`, `revised_at` timestamptz NOT NULL, `before` jsonb NOT NULL, `after` jsonb NOT NULL. Table en ajout seul : historique des corrections d'une soumission avant décision.

Les valeurs d'énumération sont des codes **en anglais** (ADR 0007, #50) : ce sont des identifiants techniques, indépendants de la langue de l'œuvre ; le front affiche le libellé traduit.

## 4. Règles transverses
- **Identité** : l'`id` de `work` est la seule clé de référence ; l'URL publique est `/work/{id}-{slug}` et seul `{id}` est lu.
- **Archivage** : toute suppression est une suppression douce, réservée à l'administrateur ; les listes publiques excluent `deleted_at IS NOT NULL` (et, pour `work`, `published_at IS NULL`). Les entrées `library_entry` d'une œuvre archivée sont conservées, masquées avec l'œuvre.
- **Pas d'ISBN, pas d'édition** dans le MVP.
- **Statistiques** : ne jamais additionner chapitres et tomes.
- **Recherche** : `pg_trgm` + `unaccent` sur `work.title`, `work_title.title` (toutes langues, quelle que soit la langue demandée), `person.name`, `publisher.name`.
- **Erreurs API** : codes stables (ex. `WORK_NOT_FOUND`, `ADMIN_REQUIRED`, `HANDLE_TAKEN`).
- **Jeu de démonstration** : `db/demo-data.sql` reproduit les cas structurels de la section 7 avec des données **entièrement fictives** (titres, auteurs, comptes en `@exemple.test`) ; il se charge avec `npm run db:seed` depuis `api/`. Les données réelles du catalogue ne vont jamais dans git.

## 5. Hors MVP mais compatible
votes, listes personnalisées, ISBN, table d'éditions. **Volontairement hors Trame** : calendrier des sorties à venir (rôle de MangaCollec) ; chapitres intermédiaires (10.5) et postfaces.

## 6. Ce que le modèle n'impose pas volontairement
Pas de mapping chapitre ↔ tome ; pas de limite de `chapters_read` par rapport à `work.chapters` ; pas d'entité « saison » (une saison 2 reste la même fiche sauf série clairement distincte).

## 7. Jeux d'acceptation (à saisir avant tout code)
Chaque cas doit entrer proprement dans le modèle, sans contournement. Les informations proviennent de Ryan ; les points entre crochets restent **à confirmer**.

| Cas | Ce qu'il teste |
|---|---|
| **Les Veilleurs du Phare** — Nolwenn Aubry | `type = series` ; statut `completed`, donc totaux renseignés : `chapters = 92` (épisodes) ; **postface** : voir note ci-dessous ; édition papier chez Éditions du Phare, `volumes = 3` ; **deux** `work_publisher` (plateforme **Webtoon** + éditeur Éditions du Phare) ; lien « lire » (plateforme) et lien « acheter » (éditeur) ; formats `manhwa` et `webtoon` (plusieurs formats sur une même fiche) |
| **Le Cartographe de Sel** — Mélodie Vasseur | `type = series` ; en cours : `volumes` et `chapters` non renseignés (affichés « ? », tomes parus non saisis) ; éditeur **Éditions Pivoine** (`kind = publisher`) ; une seule personne créditée **deux fois** (rôles `story` et `art`, clé (`work_id`, `person_id`, `role`)) ; statut `ongoing` ; format `manga` |
| **Orage Lent** — Jules Cadran | `type = series` ; en cours : `volumes` non renseigné (« ? ») ; éditeur **Atelier Cobalt** ; **tome suivant annoncé pour le printemps** (voir note ci-dessous) ; format `bd` |
| **Poing d'Étoile** — Z. Inventé | `type = series` ; en cours : `volumes` non renseigné (« ? ») ; éditeur **Atelier Cobalt** (même `publisher` qu'Orage Lent : vérifie le partage d'un éditeur entre plusieurs œuvres et la page éditeur) ; auteur crédité en `story` et `art` ; format `webcomic` |
| **Dernier Train** — D. Inventé | `type = oneshot` ; `volumes = 1` ; **auto-édition** (`publisher` de `kind = self_published` ou aucun éditeur) ; statut `completed` ; pas d'ISBN ; lien de la boutique ou du site de l'auteur ; format `bd` |
| **Le Cartographe de Sel – Escale** — Mélodie Vasseur | `type = oneshot` (hors-série d'une trentaine de pages) ; `volumes = 1` ; relation **`spin_off`** vers Le Cartographe de Sel (et affichage de l'inverse sur la fiche de la série) ; **auto-édition** (`publisher` de `kind = self_published`) alors que la série est chez Éditions Pivoine : un même auteur peut donc avoir des œuvres à éditeurs différents ; une fiche unique même s'il paraît aussi dans le recueil |
| **Le Cartographe de Sel, le Recueil** — Mélodie Vasseur + artistes invités | `type = anthology` ; `volumes = 1` ; éditeur **Éditions Pivoine** ; relation **`contains`** vers *Escale* et relation **`shared_universe`** vers Le Cartographe de Sel (bonus « coulisses » avec quelques one-shots) ; plusieurs crédits (Mélodie Vasseur + artistes invités, rôle `autre` ou `dessin`) ; histoires inédites et one-shots **sans fiche propre** tant qu'ils ne sont pas publiés seuls ; sortie annoncée → fiche créée une fois paru (RG-15) |
| Une œuvre **auto-éditée** sans éditeur | `kind = self_published` ou aucun `work_publisher`, pas de ISBN |
| **Marées Rouges** — Théo Valmont | `type = series` ; statut `ongoing`, donc `volumes` et `chapters` non renseignés (« ? ») ; éditeur **Atelier Cobalt** ; fiche d'origine d'une famille d'œuvres : la liste de ses spin-offs s'affiche par déduction de l'inverse |
| **Marées Rouges – Avant la Digue** (spin-off de Marées Rouges) | `type = series` ; statut `ongoing`, `volumes` non renseigné (« ? ») ; éditeur **Atelier Cobalt** (même `publisher` que Marées Rouges, Orage Lent et Poing d'Étoile) ; relation **`spin_off`** vers Marées Rouges (se situe avant la série et se lit indépendamment : précisé dans le synopsis) |
| **Marées Rouges – Les Phares du Nord** (spin-off de Marées Rouges) | `type = series` ; statut `ongoing`, `volumes` non renseigné (« ? ») ; éditeur **Atelier Cobalt** ; relation **`spin_off`** vers Marées Rouges (se situe après l'arc du Nord : précisé dans le synopsis) ; **deux personnes créditées** : Théo Valmont (`story`, aussi crédité sur Marées Rouges) et Kenji Inventé (`art`) ; Marées Rouges a désormais deux spin-offs (liste déduite de l'inverse) |

**Constat : les dix cas entrent dans le modèle sans contournement.** Aucun exemple réel de suite ou de préquelle n'existe dans le périmètre actuel : ces types de relation sont conservés (standard MAL, coût nul) sans jeu d'acceptation. Règles de saisie confirmées par Ryan (2026-10-09) :
1. **Les Veilleurs du Phare** : `chapters = 92` ; la **postface n'est pas comptée** (elle peut être mentionnée dans le synopsis ou une note).
2. **Chapitres intermédiaires** (ex. 10.5), postfaces, bonus : **non comptés** ; `chapters` et `chapters_read` restent des entiers.
3. **Parutions à venir** (ex. le tome suivant d'Orage Lent, annoncé pour le printemps) : **non modélisées** — le modèle ne décrit que ce qui est paru. C'est le rôle d'outils de calendrier de sorties comme MangaCollec, pas de Trame. Orage Lent étant en cours, `volumes` reste vide.
7. **Totaux des œuvres en cours** : `chapters` et `volumes` ne sont **pas saisis** tant que l'œuvre est en cours (affichés « ? », ex. « chapitres 100/? · tomes 12/? »). On les renseigne quand l'œuvre passe à `completed`. Cela évite des fiches périmées à chaque nouvelle parution.
4. **Un hors-série qui paraît aussi dans un recueil** (Escale dans le recueil) = **une seule fiche**, liée au recueil par `contains` et à la série d'origine par `spin_off`.
5. **Récits inédits d'un recueil** : pas de fiche tant qu'ils ne sont pas publiés seuls ; ils sont décrits dans le synopsis et crédités sur le recueil.
6. **Une seule relation principale par paire d'œuvres** (ex. `spin_off` pour Marées Rouges – Avant la Digue, même s'il est aussi une préquelle). La chronologie se précise dans le synopsis. Le modèle autorise techniquement une seconde relation, à n'utiliser qu'exceptionnellement.
