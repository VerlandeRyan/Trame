import { buildOpenApiDocument } from './document.js';

/** Contrat publié, commité : le web en génère ses types (`web/`, `npm run api:types`). */
export const OPENAPI_FILE_URL = new URL('../../openapi.json', import.meta.url);

export function serializeOpenApiDocument(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
}
