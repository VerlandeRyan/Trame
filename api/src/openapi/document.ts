import { z } from 'zod';
import type { ErrorCode } from '../errors.js';
import { facetsQuery, listWorksQuery, workParams, workQuery } from '../routes/work.routes.js';
import {
  errorSchema,
  featuredListSchema,
  genreListSchema,
  healthSchema,
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

const errorResponse = (code: ErrorCode, description: string) => ({
  description: `${description} Code : \`${code}\`.`,
  content: { 'application/json': { schema: schemaRef('Error') } },
});

const internalError = errorResponse('INTERNAL_ERROR', 'Erreur inattendue, sans détail.');

/** Document OpenAPI 3.1, construit depuis les schémas Zod des routes et des réponses. */
export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'API Trame',
      version: '1.0.0',
      description:
        'Catalogue de la création alternative européenne. Toutes les erreurs ont la forme `{ code, message, details? }` ; le `code` est stable.',
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
      schemas: {
        Error: toJsonSchema(errorSchema, 'output'),
        FeaturedList: toJsonSchema(featuredListSchema, 'output'),
        TopRatedList: toJsonSchema(topRatedListSchema, 'output'),
        GenreList: toJsonSchema(genreListSchema, 'output'),
        WorkDetail: toJsonSchema(workDetailSchema, 'output'),
        WorkFacets: toJsonSchema(workFacetsSchema, 'output'),
        WorkPage: toJsonSchema(workPageSchema, 'output'),
        Health: toJsonSchema(healthSchema, 'output'),
      },
    },
  };
}
