// Types des réponses de l'API, tirés de `api-schema.ts` (généré depuis `api/openapi.json` par
// `npm run api:types`). Seul endroit où l'on nomme un morceau du contrat : jamais de type recopié.
import type { components } from './api-schema'

type Schemas = components['schemas']

// Œuvres
export type WorkPage = Schemas['WorkPage']
export type WorkSummary = WorkPage['items'][number]
export type WorkType = WorkSummary['type']
export type WorkStatus = WorkSummary['status']
export type WorkFacets = Schemas['WorkFacets']
export type FacetCount = WorkFacets['type'][number]

// Fiche œuvre
export type WorkDetail = Schemas['WorkDetail']
export type WorkCredit = WorkDetail['credits'][number]
export type ExternalLink = WorkDetail['links'][number]
export type WorkRelation = WorkDetail['relations'][number]
export type CreditRole = WorkCredit['roles'][number]
export type RelationKind = WorkRelation['relation']

// Accueil
export type FeaturedWork = Schemas['FeaturedList']['items'][number]
export type RatedWork = Schemas['TopRatedList']['items'][number]
export type GenreItem = Schemas['GenreList']['items'][number]

// Liste de lecture
type RawListPage = Schemas['LibraryPage']
export type ListedEntry = RawListPage['items'][number]
export type ListedWork = ListedEntry['work']
export type LibraryEntry = ListedEntry['entry']
export type LibraryStatus = LibraryEntry['status']
export type ReadingTotals = RawListPage['totals']

/** Un nombre par statut : le contrat les décrit comme un dictionnaire, l'API les donne tous. */
export type StatusCounts = Record<LibraryStatus, number>

export type ListPage = Omit<RawListPage, 'statusCounts'> & { statusCounts: StatusCounts }

// Profil
type RawProfile = Schemas['Profile']
type RawProfileDetails = NonNullable<RawProfile['details']>
export type ProfileVisibility = RawProfile['visibility']
export type ProfileUpdate = RawProfileDetails['recentUpdates'][number]
export type ProfileRatedWork = RawProfileDetails['topRated'][number]
export type ProfileStats = Omit<RawProfileDetails['stats'], 'statusCounts'> & {
  statusCounts: StatusCounts
}
export type ProfileDetails = Omit<RawProfileDetails, 'stats'> & { stats: ProfileStats }
export type Profile = Omit<RawProfile, 'details'> & { details: ProfileDetails | null }

// Connexion
export type AuthState = Schemas['AuthStatus']
export type AuthUser = Extract<AuthState, { status: 'authenticated' }>['user']
