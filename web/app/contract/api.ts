/**
 * API response types, taken from the generated `api-schema.ts`. The only place that names a
 * piece of the contract: never copy a type elsewhere.
 */
import type { components, operations } from './api-schema'

type Schemas = components['schemas']

// Runtime values of the enumerations, generated with the types: never copied.
export {
  creditRoleValues as CREDIT_ROLES,
  errorCodeValues as ERROR_CODES,
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
  // Values of the list filter `lifecycle` (the generator's long name, aliased once).
  pathsApiV1AdminWorksGetParametersQueryLifecycleValues as ADMIN_LIFECYCLE_FILTERS,
  // Sort orders of the administration work list.
  pathsApiV1AdminWorksGetParametersQuerySortValues as ADMIN_WORK_SORTS,
  // Sort orders of the search and of the reading list.
  pathsApiV1WorksGetParametersQuerySortValues as SEARCH_SORTS,
  pathsApiV1MeEntriesGetParametersQuerySortValues as LIST_SORTS,
  publicationGapValues as PUBLICATION_GAPS,
} from './api-schema'

// Works
export type WorkPage = Schemas['WorkPage']
export type WorkSummary = WorkPage['items'][number]
export type WorkType = WorkSummary['type']
export type WorkStatus = WorkSummary['status']
export type WorkFacets = Schemas['WorkFacets']
export type FacetCount = WorkFacets['type'][number]
/** The query parameters of the work search: the filters are checked against its keys. */
export type WorkSearchParams = NonNullable<operations['listWorks']['parameters']['query']>
export type SearchSort = NonNullable<WorkSearchParams['sort']>

/** An error code of the API. */
export type ErrorCode = Schemas['Error']['code']

// Work detail
export type WorkDetail = Schemas['WorkDetail']
export type WorkCredit = WorkDetail['credits'][number]
export type ExternalLink = WorkDetail['links'][number]
export type WorkRelation = WorkDetail['relations'][number]
export type CreditRole = WorkCredit['roles'][number]
export type RelationKind = WorkRelation['relation']

// Catalogue administration: the fiches as read for editing
export type AdminPerson = Schemas['AdminPerson']
export type AdminPublisher = Schemas['AdminPublisher']
export type AdminWork = Schemas['AdminWork']
export type AdminLifecycle = AdminWork['lifecycle']
/** An external link of a work (read, buy) or of a person (website, social). */
export type AdminLink = AdminWork['links'][number] | AdminPerson['links'][number]
export type AdminDraftCounts = Schemas['AdminDraftCounts']
/** A page of an administration list: the contract's pagination around the items of one kind. */
export type AdminPage<T> = Omit<Schemas['AdminWorkPage'], 'items'> & { items: T[] }
/** A cited record as the pickers show it: identifier and name. */
export type AdminRecordLabel = AdminWork['labels']['people'][number]
export type PublicationGap = Schemas['PublicationGap']

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
/** Sort orders of the reading list. */
export type ListSort = NonNullable<
  NonNullable<operations['listLibraryEntries']['parameters']['query']>['sort']
>
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
