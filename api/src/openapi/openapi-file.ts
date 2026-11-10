/** Location and serialisation of the committed API contract file. */
import { buildOpenApiDocument } from './document.js';

/** Published contract, committed: the web app generates its types from it. */
export const OPENAPI_FILE_URL = new URL('../../openapi.json', import.meta.url);

/** The OpenAPI document as formatted JSON text, ending with a newline. */
export function serializeOpenApiDocument(): string {
  return `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;
}
