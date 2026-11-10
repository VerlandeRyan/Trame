/**
 * API response types, taken from the generated `api-schema.ts`. The only place that names a
 * piece of the contract: never copy a type elsewhere.
 */
import type { components } from './api-schema'

type Schemas = components['schemas']

// Runtime values of the enumerations, generated with the types: never copied.
export {
  creditRoleValues as CREDIT_ROLES,
  externalLinkKindValues as LINK_KINDS,
  libraryStatusValues as LIBRARY_STATUSES,
  personKindValues as PERSON_KINDS,
  personLinkKindValues as PERSON_LINK_KINDS,
  publisherKindValues as PUBLISHER_KINDS,
  relationKindValues as RELATION_KINDS,
  synopsisSourceValues as SYNOPSIS_SOURCES,
  titleKindValues as TITLE_KINDS,
  workLinkKindValues as WORK_LINK_KINDS,
  workStatusValues as WORK_STATUSES,
  workTypeValues as WORK_TYPES,
} from './api-schema'

// Works
export type WorkPage = Schemas['WorkPage']
export type WorkSummary = WorkPage['items'][number]
export type WorkType = WorkSummary['type']
export type WorkStatus = WorkSummary['status']
export type WorkFacets = Schemas['WorkFacets']
export type FacetCount = WorkFacets['type'][number]

// Work detail
export type WorkDetail = Schemas['WorkDetail']
export type WorkCredit = WorkDetail['credits'][number]
export type ExternalLink = WorkDetail['links'][number]
export type WorkRelation = WorkDetail['relations'][number]
export type CreditRole = WorkCredit['roles'][number]
export type RelationKind = WorkRelation['relation']

// Home
export type FeaturedWork = Schemas['FeaturedList']['items'][number]
export type RatedWork = Schemas['TopRatedList']['items'][number]
export type GenreItem = Schemas['GenreList']['items'][number]

// Reading list
type RawListPage = Schemas['LibraryPage']
export type ListedEntry = RawListPage['items'][number]
export type ListedWork = ListedEntry['work']
export type LibraryEntry = ListedEntry['entry']
export type LibraryStatus = LibraryEntry['status']
export type ReadingTotals = RawListPage['totals']

/** One number per status: the contract describes them as a dictionary, the API gives them all. */
export type StatusCounts = Record<LibraryStatus, number>

/** A page of the reading list, with the status counts typed per status. */
export type ListPage = Omit<RawListPage, 'statusCounts'> & { statusCounts: StatusCounts }

// Profile
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

// Sign-in
export type AuthState = Schemas['AuthStatus']
export type AuthUser = Extract<AuthState, { status: 'authenticated' }>['user']
