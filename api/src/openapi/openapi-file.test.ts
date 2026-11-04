import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './document.js';
import { OPENAPI_FILE_URL, serializeOpenApiDocument } from './openapi-file.js';

describe('api/openapi.json', () => {
  it('est à jour : `npm run openapi:export` le régénère après un changement de contrat', () => {
    expect(readFileSync(OPENAPI_FILE_URL, 'utf8')).toBe(serializeOpenApiDocument());
  });

  it('donne à chaque opération un operationId unique (les clients générés en dépendent)', () => {
    const operations = Object.values(buildOpenApiDocument().paths).flatMap((pathItem) =>
      Object.values(pathItem as Record<string, { operationId?: string }>),
    );
    const ids = operations.map((operation) => operation.operationId);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });
});
