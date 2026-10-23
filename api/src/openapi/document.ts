import { z } from 'zod';
import type { ErrorCode } from '../errors.js';
import { handleBody, loginQuery } from '../routes/auth.routes.js';
import { entryBody, listEntriesQuery } from '../routes/library.routes.js';
import { profileParams, profileQuery, visibilityBody } from '../routes/profile.routes.js';
import { SESSION_COOKIE_NAME } from '../session/middleware.js';
import { facetsQuery, listWorksQuery, workParams, workQuery } from '../routes/work.routes.js';
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
          parameters: [...toParameters(workParams, 'path'), ...toParameters(workQuery, 'query')],
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
          parameters: toParameters(workParams, 'path'),
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
          parameters: toParameters(workParams, 'path'),
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
          parameters: toParameters(workParams, 'path'),
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
