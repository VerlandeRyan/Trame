/** Script entry point: writes the published API contract file, with no server or database. */
import { writeFileSync } from 'node:fs';
import { OPENAPI_FILE_URL, serializeOpenApiDocument } from './openapi-file.js';

writeFileSync(OPENAPI_FILE_URL, serializeOpenApiDocument());
console.log('api/openapi.json écrit.');
