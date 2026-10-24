import { z } from 'zod';
import type { ErrorCode } from '../errors.js';
import {
  adminListQuery,
  adminWorkListQuery,
  personBody,
  publisherBody,
  workBody,
} from '../schemas/admin-catalogue.js';
import { idParams } from '../schemas/common.js';
import { handleBody, loginQuery } from '../routes/auth.routes.js';
import { entryBody, listEntriesQuery } from '../routes/library.routes.js';
import { profileParams, profileQuery, visibilityBody } from '../routes/profile.routes.js';
import { SESSION_COOKIE_NAME } from '../session/middleware.js';
import { facetsQuery, listWorksQuery, workQuery } from '../routes/work.routes.js';
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

/** Préfixe sous lequel `routes/index.ts` monte les routes versionnées. */
export const API_PREFIX = '/api/v1';

type JsonSchema = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io }) as JsonSchema;
  return rest;
}

/** Une entrée de paramètre OpenAPI par propriété du schéma. */
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

const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonResponse = (name: string, description: string) => ({
  description,
  content: { 'application/json': { schema: schemaRef(name) } },
});

const redirectResponse = (description: string) => ({
  description,
  headers: { Location: { schema: { type: 'string' } } },
});

const errorResponse = (code: ErrorCode, description: string) => ({
  description: `${description} Code : \`${code}\`.`,
  content: { 'application/json': { schema: schemaRef('Error') } },
});

const internalError = errorResponse('INTERNAL_ERROR', 'Erreur inattendue, sans détail.');
const rateLimited = errorResponse(
  'RATE_LIMITED',
  'Trop de requêtes depuis cette adresse ; réessayer après le délai de `Retry-After`.',
);

interface AdminResource {
  /** Segment d'URL sous `/admin`. */
  path: string;
  /** Nom de la ressource dans les `operationId` (`listPeople` → `People`). */
  plural: string;
  singular: string;
  /** Composants de réponse : un enregistrement et une page. */
  record: string;
  page: string;
  body: z.ZodType;
  /** Paramètres de la liste (recherche, portée, page, et filtres propres à la ressource). */
  listQuery: z.ZodObject;
  /** Code renvoyé (409) quand l'archivage est refusé, le cas échéant. */
  archiveBlockedBy?: ErrorCode;
  /** Code renvoyé (400) quand le corps cite un enregistrement inexistant, le cas échéant. */
  invalidReference?: boolean;
  /** Le remplacement porte la version lue (`updatedAt`) et répond 409 `STALE_RECORD` si elle a changé. */
  versioned?: boolean;
}

const adminErrors = {
  '401': errorResponse('UNAUTHENTICATED', 'Connexion requise.'),
  '403': errorResponse(
    'ADMIN_REQUIRED',
    'Rôle administrateur requis (ou `FORBIDDEN_ORIGIN` pour une origine refusée).',
  ),
  '500': internalError,
};

const adminSecurity = [{ sessionCookie: [] }];

/** Les six opérations d'une ressource du catalogue : liste, lecture, création, remplacement, archivage, restauration. */
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
        operationId: `list${resource.plural}`,
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
        operationId: `create${resource.singular}`,
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
        operationId: `get${resource.singular}`,
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
        operationId: `replace${resource.singular}`,
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
        operationId: `archive${resource.singular}`,
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
        operationId: `restore${resource.singular}`,
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

/** Document OpenAPI 3.1, construit depuis les schémas Zod des routes et des réponses. */
export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'API Trame',
      version: '1.0.0',
      description:
        'Catalogue de la création européenne, d’auteurs indépendants comme d’éditeurs établis. Toutes les erreurs ont la forme `{ code, message, details? }` ; le `code` est stable.',
    },
    // Chemins complets : `/health` est à la racine, hors `/api/v1`, et les clients (Scalar) ignorent
    // les serveurs propres à un chemin.
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
          name: SESSION_COOKIE_NAME,
          description: 'Cookie de session `httpOnly`, posé par la connexion Google.',
        },
      },
      schemas: {
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
