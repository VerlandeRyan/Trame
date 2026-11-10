/** Builds the OpenAPI document of the API from the Zod request and response schemas. */
import { z } from 'zod';
import {
  CREDIT_ROLES,
  EXTERNAL_LINK_KINDS,
  GENRE_CATEGORIES,
  PERSON_KINDS,
  PERSON_LINK_KINDS,
  PUBLISHER_KINDS,
  RELATION_KINDS,
  SYNOPSIS_SOURCES,
  TITLE_KINDS,
  WORK_LINK_KINDS,
  WORK_STATUSES,
  WORK_TYPES,
} from '../domain/catalogue-enums.js';
import { LIBRARY_STATUSES, PROFILE_VISIBILITIES, USER_ROLES } from '../domain/user-enums.js';
import type { ErrorCode } from '../errors.js';
import {
  adminListQuery,
  adminWorkListQuery,
  personBody,
  publisherBody,
  workBody,
} from '../schemas/admin-catalogue.js';
import { handleBody, loginQuery } from '../schemas/auth.js';
import { idParams } from '../schemas/common.js';
import { entryBody, listEntriesQuery } from '../schemas/library.js';
import { profileParams, profileQuery, visibilityBody } from '../schemas/profile.js';
import { facetsQuery, listWorksQuery, workQuery } from '../schemas/work.js';
import { sessionCookieName } from '../session/middleware.js';
import {
  adminPersonPageSchema,
  adminPersonSchema,
  adminPublisherPageSchema,
  adminPublisherSchema,
  adminWorkPageSchema,
  adminWorkSchema,
} from './admin-schemas.js';
import {
  authStatusSchema,
  errorSchema,
  featuredListSchema,
  genreListSchema,
  healthSchema,
  libraryEntryResponseSchema,
  libraryPageSchema,
  profileSchema,
  profileVisibilitySchema,
  topRatedListSchema,
  workDetailSchema,
  workFacetsSchema,
  workPageSchema,
} from './schemas.js';

/** Prefix under which the versioned routes are mounted. */
export const API_PREFIX = '/api/v1';

type JsonSchema = Record<string, unknown>;

/** Enumerations published as named components: the web app generates its runtime values from them. */
const NAMED_ENUMS: Record<string, readonly string[]> = {
  WorkType: WORK_TYPES,
  WorkStatus: WORK_STATUSES,
  CreditRole: CREDIT_ROLES,
  RelationKind: RELATION_KINDS,
  PublisherKind: PUBLISHER_KINDS,
  PersonKind: PERSON_KINDS,
  ExternalLinkKind: EXTERNAL_LINK_KINDS,
  WorkLinkKind: WORK_LINK_KINDS,
  PersonLinkKind: PERSON_LINK_KINDS,
  TitleKind: TITLE_KINDS,
  SynopsisSource: SYNOPSIS_SOURCES,
  GenreCategory: GENRE_CATEGORIES,
  LibraryStatus: LIBRARY_STATUSES,
  UserRole: USER_ROLES,
  // `ProfileVisibility` already names the response of the visibility update.
  Visibility: PROFILE_VISIBILITIES,
};

/** Component name looked up by the joined values of an enumeration. */
const enumNameByValues = new Map(
  Object.entries(NAMED_ENUMS).map(([name, values]) => [values.join('|'), name]),
);

/** The named enumerations as JSON Schema components. */
const enumComponents = Object.fromEntries(
  Object.entries(NAMED_ENUMS).map(([name, values]) => [
    name,
    { type: 'string', enum: [...values] },
  ]),
);

/** Replaces every inline enumeration that repeats a named component's values with a `$ref`. */
function referenceNamedEnums(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(referenceNamedEnums);
  if (node === null || typeof node !== 'object') return node;
  const { type: _type, enum: values, ...rest } = node as JsonSchema;
  const name = Array.isArray(values) ? enumNameByValues.get(values.join('|')) : undefined;
  if (name !== undefined) return { $ref: `#/components/schemas/${name}`, ...rest };
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, referenceNamedEnums(value)]),
  );
}

/** Converts a Zod schema to JSON Schema, with enumerations replaced by references. */
function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io }) as JsonSchema;
  return referenceNamedEnums(rest) as JsonSchema;
}

/** One OpenAPI parameter entry per property of the schema. */
function toParameters(schema: z.ZodObject, location: 'query' | 'path') {
  const { properties = {}, required = [] } = toJsonSchema(schema, 'input') as {
    properties?: Record<string, JsonSchema>;
    required?: string[];
  };
  return Object.entries(properties).map(([name, { description, ...rest }]) => ({
    name,
    in: location,
    required: location === 'path' || required.includes(name),
    ...(description === undefined ? {} : { description }),
    schema: rest,
  }));
}

/** Reference to a named schema component. */
const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** A JSON response described by a named schema. */
const jsonResponse = (name: string, description: string) => ({
  description,
  content: { 'application/json': { schema: schemaRef(name) } },
});

/** A redirect response carrying a `Location` header. */
const redirectResponse = (description: string) => ({
  description,
  headers: { Location: { schema: { type: 'string' } } },
});

/** An error response; the stable code is appended to the description. */
const errorResponse = (code: ErrorCode, description: string) => ({
  description: `${description} Code : \`${code}\`.`,
  content: { 'application/json': { schema: schemaRef('Error') } },
});

const internalError = errorResponse('INTERNAL_ERROR', 'Erreur inattendue, sans détail.');
const rateLimited = errorResponse(
  'RATE_LIMITED',
  'Trop de requêtes depuis cette adresse ; réessayer après le délai de `Retry-After`.',
);

/** Describes one administered resource so its six operations can be generated. */
interface AdminResource {
  /** URL segment under the admin prefix. */
  path: string;
  /** Resource name inside the administration `operationId`s (`listAdminPeople` → `People`). */
  plural: string;
  singular: string;
  /** Response components: one record and one page. */
  record: string;
  page: string;
  body: z.ZodType;
  /** List parameters (search, scope, page, and filters specific to the resource). */
  listQuery: z.ZodObject;
  /** Code returned (409) when archiving is refused, if applicable. */
  archiveBlockedBy?: ErrorCode;
  /** Whether the body can cite a missing record (400). */
  invalidReference?: boolean;
  /** The replacement carries the version that was read (`updatedAt`) and answers 409 `STALE_RECORD` if it changed. */
  versioned?: boolean;
}

/** Error responses common to every administration operation. */
const adminErrors = {
  '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
  '403': errorResponse(
    'ADMIN_REQUIRED',
    'Rôle administrateur requis (ou `FORBIDDEN_ORIGIN` pour une origine refusée).',
  ),
  '500': internalError,
};

const adminSecurity = [{ sessionCookie: [] }];

/** The six operations of a catalogue resource: list, read, create, replace, archive, restore. */
function adminResourcePaths(resource: AdminResource) {
  const base = `${API_PREFIX}/admin/${resource.path}`;
  const idParameters = toParameters(idParams, 'path');
  const notFound = errorResponse('NOT_FOUND', `${resource.singular} inconnu.`);
  const invalidBody = errorResponse(
    resource.invalidReference ? 'INVALID_REFERENCE' : 'VALIDATION_ERROR',
    resource.invalidReference
      ? 'Corps invalide (`VALIDATION_ERROR`), enregistrement cité inexistant (`INVALID_REFERENCE`) ou archivé (`ARCHIVED_REFERENCE`).'
      : 'Corps invalide.',
  );
  const staleRecord = resource.versioned
    ? { '409': errorResponse('STALE_RECORD', 'La fiche a été modifiée depuis sa lecture.') }
    : {};
  const archiveBlocked = resource.archiveBlockedBy
    ? { '409': errorResponse(resource.archiveBlockedBy, 'Des œuvres non archivées y sont liées.') }
    : {};
  const writeBase = { tags: ['admin'], security: adminSecurity };
  const writeBody = {
    required: true,
    content: { 'application/json': { schema: toJsonSchema(resource.body, 'input') } },
  };
  return {
    [base]: {
      get: {
        summary: `Lister : ${resource.plural}`,
        operationId: `listAdmin${resource.plural}`,
        tags: ['admin'],
        security: adminSecurity,
        parameters: toParameters(resource.listQuery, 'query'),
        responses: {
          '200': jsonResponse(resource.page, 'Une page, archives comprises selon `scope`.'),
          '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
          ...adminErrors,
        },
      },
      post: {
        ...writeBase,
        summary: `Créer : ${resource.singular}`,
        operationId: `createAdmin${resource.singular}`,
        requestBody: writeBody,
        responses: {
          '201': jsonResponse(resource.record, 'Créé.'),
          '400': invalidBody,
          '429': rateLimited,
          ...adminErrors,
        },
      },
    },
    [`${base}/{id}`]: {
      get: {
        summary: `Lire : ${resource.singular}`,
        operationId: `getAdmin${resource.singular}`,
        tags: ['admin'],
        security: adminSecurity,
        parameters: idParameters,
        responses: {
          '200': jsonResponse(resource.record, 'La fiche, archivée ou non.'),
          '400': errorResponse('VALIDATION_ERROR', 'Identifiant invalide.'),
          '404': notFound,
          ...adminErrors,
        },
      },
      put: {
        ...writeBase,
        summary: `Remplacer : ${resource.singular}`,
        operationId: `replaceAdmin${resource.singular}`,
        parameters: idParameters,
        requestBody: writeBody,
        responses: {
          '200': jsonResponse(resource.record, 'Enregistrée.'),
          '400': invalidBody,
          '404': notFound,
          ...staleRecord,
          '429': rateLimited,
          ...adminErrors,
        },
      },
    },
    [`${base}/{id}/archive`]: {
      post: {
        ...writeBase,
        summary: `Archiver : ${resource.singular}`,
        operationId: `archiveAdmin${resource.singular}`,
        parameters: idParameters,
        responses: {
          '200': jsonResponse(resource.record, 'Archivée (sans effet si elle l’est déjà).'),
          '400': errorResponse('VALIDATION_ERROR', 'Identifiant invalide.'),
          '404': notFound,
          ...archiveBlocked,
          '429': rateLimited,
          ...adminErrors,
        },
      },
    },
    [`${base}/{id}/restore`]: {
      post: {
        ...writeBase,
        summary: `Restaurer : ${resource.singular}`,
        operationId: `restoreAdmin${resource.singular}`,
        parameters: idParameters,
        responses: {
          '200': jsonResponse(resource.record, 'Restaurée (sans effet si elle ne l’est pas).'),
          '400': errorResponse('VALIDATION_ERROR', 'Identifiant invalide.'),
          '404': notFound,
          '429': rateLimited,
          ...adminErrors,
        },
      },
    },
  };
}

/** OpenAPI 3.1 document, built from the Zod schemas of the routes and responses. */
export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'API Trame',
      version: '1.0.0',
      description:
        'Catalogue de la création européenne, d’auteurs indépendants comme d’éditeurs établis. Toutes les erreurs ont la forme `{ code, message, details? }` ; le `code` est stable.',
    },
    // Full paths: the health probe sits at the root, outside the API prefix, and clients ignore
    // path-specific servers.
    servers: [{ url: '/' }],
    paths: {
      '/health': {
        get: {
          summary: 'Sonde de santé (base de données comprise)',
          operationId: 'getHealth',
          tags: ['health'],
          responses: {
            '200': jsonResponse('Health', 'Service et base opérationnels.'),
            '503': jsonResponse('Health', 'Base de données injoignable (`status: degraded`).'),
          },
        },
      },
      [`${API_PREFIX}/works`]: {
        get: {
          summary: 'Rechercher et lister les œuvres',
          operationId: 'listWorks',
          tags: ['works'],
          parameters: toParameters(listWorksQuery, 'query'),
          responses: {
            '200': jsonResponse('WorkPage', 'Une page d’œuvres.'),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/works/facets`]: {
        get: {
          summary: 'Compter les œuvres par valeur de filtre',
          operationId: 'getWorkFacets',
          tags: ['works'],
          parameters: toParameters(facetsQuery, 'query'),
          responses: {
            '200': jsonResponse('WorkFacets', 'Compteurs par groupe de filtres.'),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/works/featured`]: {
        get: {
          summary: 'Œuvres « à la une » de l’accueil (populaires cette semaine)',
          operationId: 'getFeaturedWorks',
          tags: ['works'],
          parameters: toParameters(workQuery, 'query'),
          responses: {
            '200': jsonResponse(
              'FeaturedList',
              'Au plus 3 œuvres ayant au moins 3 ajouts sur 7 jours.',
            ),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/works/top-rated`]: {
        get: {
          summary: 'Œuvres les mieux notées',
          operationId: 'getTopRatedWorks',
          tags: ['works'],
          parameters: toParameters(workQuery, 'query'),
          responses: {
            '200': jsonResponse('TopRatedList', 'Au plus 12 œuvres ayant au moins 10 notes.'),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/works/{id}`]: {
        get: {
          summary: 'Lire une fiche œuvre',
          operationId: 'getWork',
          tags: ['works'],
          parameters: [...toParameters(idParams, 'path'), ...toParameters(workQuery, 'query')],
          responses: {
            '200': jsonResponse('WorkDetail', 'La fiche.'),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '404': errorResponse('NOT_FOUND', 'Œuvre inconnue ou archivée.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/auth/google`]: {
        get: {
          summary: 'Démarrer la connexion Google',
          operationId: 'startGoogleLogin',
          tags: ['auth'],
          parameters: toParameters(loginQuery, 'query'),
          responses: {
            '302': redirectResponse('Redirection vers l’écran de connexion de Google.'),
            '429': rateLimited,
            '503': errorResponse('AUTH_UNAVAILABLE', 'Connexion Google non configurée.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/auth/google/callback`]: {
        get: {
          summary: 'Retour de Google après la connexion',
          operationId: 'finishGoogleLogin',
          tags: ['auth'],
          parameters: ['code', 'state', 'error'].map((name) => ({
            name,
            in: 'query',
            required: false,
            description: 'Renseigné par Google.',
            schema: { type: 'string' },
          })),
          responses: {
            '302': redirectResponse(
              'Redirection vers le front : `returnTo` ou `/` (compte existant), `/signup/handle?returnTo=…` (nouveau compte, handle à choisir) ou `/?auth_error=<code>` (refus ou échec).',
            ),
            '429': rateLimited,
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/auth/me`]: {
        get: {
          summary: 'Savoir qui est connecté',
          operationId: 'getAuthStatus',
          tags: ['auth'],
          security: [{}, { sessionCookie: [] }],
          responses: {
            '200': jsonResponse('AuthStatus', 'Visiteur, inscription en attente ou connecté.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/auth/handle`]: {
        post: {
          summary: 'Choisir son handle et créer le compte',
          operationId: 'createAccount',
          tags: ['auth'],
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: toJsonSchema(handleBody, 'input') } },
          },
          responses: {
            '201': jsonResponse('AuthStatus', 'Compte créé et connecté.'),
            '400': errorResponse(
              'VALIDATION_ERROR',
              'Format invalide (ou `HANDLE_NOT_ALLOWED` pour un mot réservé ou interdit).',
            ),
            '401': errorResponse(
              'SIGNUP_EXPIRED',
              'Aucune inscription en cours, ou elle a expiré (10 minutes).',
            ),
            '403': errorResponse('FORBIDDEN_ORIGIN', 'Origine de la requête refusée.'),
            '409': errorResponse('HANDLE_TAKEN', 'Handle déjà pris (casse ignorée).'),
            '429': rateLimited,
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/auth/cancel`]: {
        post: {
          summary: 'Abandonner l’inscription en cours',
          operationId: 'cancelSignup',
          tags: ['auth'],
          responses: {
            '204': { description: 'Session détruite, aucun compte créé.' },
            '403': errorResponse('FORBIDDEN_ORIGIN', 'Origine de la requête refusée.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/auth/logout`]: {
        post: {
          summary: 'Se déconnecter',
          operationId: 'signOut',
          tags: ['auth'],
          responses: {
            '204': { description: 'Session détruite.' },
            '403': errorResponse('FORBIDDEN_ORIGIN', 'Origine de la requête refusée.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/me/entries`]: {
        get: {
          summary: 'Lister ma liste de lecture',
          operationId: 'listLibraryEntries',
          tags: ['library'],
          security: [{ sessionCookie: [] }],
          parameters: toParameters(listEntriesQuery, 'query'),
          responses: {
            '200': jsonResponse('LibraryPage', 'Une page de ma liste, avec les compteurs.'),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
            '403': errorResponse('HANDLE_REQUIRED', 'Inscription en attente du choix du handle.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/me/profile`]: {
        patch: {
          summary: 'Régler la visibilité de mon profil',
          operationId: 'setProfileVisibility',
          tags: ['profile'],
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: toJsonSchema(visibilityBody, 'input') } },
          },
          responses: {
            '200': jsonResponse('ProfileVisibility', 'Visibilité enregistrée.'),
            '400': errorResponse('VALIDATION_ERROR', 'Corps invalide.'),
            '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
            '403': errorResponse('FORBIDDEN_ORIGIN', 'Origine de la requête refusée.'),
            '429': rateLimited,
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/users/{handle}`]: {
        get: {
          summary: 'Lire le profil d’un membre',
          operationId: 'getProfile',
          tags: ['profile'],
          parameters: [
            ...toParameters(profileParams, 'path'),
            ...toParameters(profileQuery, 'query'),
          ],
          responses: {
            '200': jsonResponse(
              'Profile',
              'Le profil ; `details` est `null` si le profil est privé et que le lecteur n’en est pas le propriétaire.',
            ),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '404': errorResponse('NOT_FOUND', 'Aucun membre avec ce pseudo.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/users/{handle}/entries`]: {
        get: {
          summary: 'Lister la liste de lecture d’un membre',
          operationId: 'listProfileEntries',
          tags: ['profile'],
          parameters: [
            ...toParameters(profileParams, 'path'),
            ...toParameters(listEntriesQuery, 'query'),
          ],
          responses: {
            '200': jsonResponse('LibraryPage', 'Une page de sa liste, avec les compteurs.'),
            '400': errorResponse('VALIDATION_ERROR', 'Paramètres invalides.'),
            '403': errorResponse('PROFILE_PRIVATE', 'Profil privé.'),
            '404': errorResponse('NOT_FOUND', 'Aucun membre avec ce pseudo.'),
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/works/{id}/entry`]: {
        get: {
          summary: 'Lire mon suivi d’une œuvre',
          operationId: 'getLibraryEntry',
          tags: ['library'],
          security: [{ sessionCookie: [] }],
          parameters: toParameters(idParams, 'path'),
          responses: {
            '200': jsonResponse('LibraryEntryResponse', 'Mon entrée, ou `null` si absente.'),
            '400': errorResponse('VALIDATION_ERROR', 'Identifiant invalide.'),
            '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
            '403': errorResponse('HANDLE_REQUIRED', 'Inscription en attente du choix du handle.'),
            '404': errorResponse('NOT_FOUND', 'Œuvre inconnue ou archivée.'),
            '500': internalError,
          },
        },
        put: {
          summary: 'Ajouter une œuvre à ma liste ou mettre à jour mon suivi',
          operationId: 'saveLibraryEntry',
          tags: ['library'],
          security: [{ sessionCookie: [] }],
          parameters: toParameters(idParams, 'path'),
          requestBody: {
            required: true,
            content: { 'application/json': { schema: toJsonSchema(entryBody, 'input') } },
          },
          responses: {
            '200': jsonResponse('LibraryEntryResponse', 'Entrée enregistrée.'),
            '400': errorResponse('VALIDATION_ERROR', 'Corps ou identifiant invalide.'),
            '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
            '403': errorResponse('FORBIDDEN_ORIGIN', 'Origine de la requête refusée.'),
            '404': errorResponse('NOT_FOUND', 'Œuvre inconnue ou archivée.'),
            '429': rateLimited,
            '500': internalError,
          },
        },
        delete: {
          summary: 'Retirer une œuvre de ma liste',
          operationId: 'removeLibraryEntry',
          tags: ['library'],
          security: [{ sessionCookie: [] }],
          parameters: toParameters(idParams, 'path'),
          responses: {
            '204': { description: 'Entrée retirée (ou déjà absente).' },
            '400': errorResponse('VALIDATION_ERROR', 'Identifiant invalide.'),
            '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
            '403': errorResponse('FORBIDDEN_ORIGIN', 'Origine de la requête refusée.'),
            '404': errorResponse('NOT_FOUND', 'Œuvre inconnue ou archivée.'),
            '429': rateLimited,
            '500': internalError,
          },
        },
      },
      [`${API_PREFIX}/genres`]: {
        get: {
          summary: 'Lister les formats et les genres',
          operationId: 'listGenres',
          tags: ['genres'],
          responses: {
            '200': jsonResponse('GenreList', 'Codes avec leur catégorie, sans libellé traduit.'),
            '500': internalError,
          },
        },
      },
      ...adminResourcePaths({
        path: 'people',
        plural: 'People',
        singular: 'Person',
        record: 'AdminPerson',
        page: 'AdminPersonPage',
        body: personBody,
        listQuery: adminListQuery,
        archiveBlockedBy: 'PERSON_HAS_WORKS',
      }),
      ...adminResourcePaths({
        path: 'publishers',
        plural: 'Publishers',
        singular: 'Publisher',
        record: 'AdminPublisher',
        page: 'AdminPublisherPage',
        body: publisherBody,
        listQuery: adminListQuery,
        archiveBlockedBy: 'PUBLISHER_HAS_WORKS',
      }),
      ...adminResourcePaths({
        path: 'works',
        plural: 'Works',
        singular: 'Work',
        record: 'AdminWork',
        page: 'AdminWorkPage',
        body: workBody,
        listQuery: adminWorkListQuery,
        invalidReference: true,
        versioned: true,
      }),
    },
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: sessionCookieName(true),
          description:
            'Cookie de session `httpOnly`, posé par la connexion Google. Nommé `trame.sid` seulement en HTTP local (sans `Secure`).',
        },
      },
      schemas: {
        ...enumComponents,
        Error: toJsonSchema(errorSchema, 'output'),
        AdminPerson: toJsonSchema(adminPersonSchema, 'output'),
        AdminPersonPage: toJsonSchema(adminPersonPageSchema, 'output'),
        AdminPublisher: toJsonSchema(adminPublisherSchema, 'output'),
        AdminPublisherPage: toJsonSchema(adminPublisherPageSchema, 'output'),
        AdminWork: toJsonSchema(adminWorkSchema, 'output'),
        AdminWorkPage: toJsonSchema(adminWorkPageSchema, 'output'),
        AuthStatus: toJsonSchema(authStatusSchema, 'output'),
        FeaturedList: toJsonSchema(featuredListSchema, 'output'),
        TopRatedList: toJsonSchema(topRatedListSchema, 'output'),
        GenreList: toJsonSchema(genreListSchema, 'output'),
        LibraryEntryResponse: toJsonSchema(libraryEntryResponseSchema, 'output'),
        LibraryPage: toJsonSchema(libraryPageSchema, 'output'),
        Profile: toJsonSchema(profileSchema, 'output'),
        ProfileVisibility: toJsonSchema(profileVisibilitySchema, 'output'),
        WorkDetail: toJsonSchema(workDetailSchema, 'output'),
        WorkFacets: toJsonSchema(workFacetsSchema, 'output'),
        WorkPage: toJsonSchema(workPageSchema, 'output'),
        Health: toJsonSchema(healthSchema, 'output'),
      },
    },
  };
}
