import { writeFileSync } from 'node:fs';
import { OPENAPI_FILE_URL, serializeOpenApiDocument } from './openapi-file.js';

// Point d'entrée de `npm run openapi:export` : écrit `api/openapi.json`, sans serveur ni base.
writeFileSync(OPENAPI_FILE_URL, serializeOpenApiDocument());
console.log('api/openapi.json écrit.');
