import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as catalogueEnums from './catalogue-enums.js';
import * as userEnums from './user-enums.js';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const LITERAL_ENUM = /z\s*\.enum\(\s*\[([^\]]*)\]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

function toKey(values: readonly string[]): string {
  return [...values].sort((a, b) => a.localeCompare(b)).join('|');
}

const exportedValues: unknown[] = [...Object.values(catalogueEnums), ...Object.values(userEnums)];
const sharedEnumKeys = new Set(
  exportedValues.filter((value): value is string[] => Array.isArray(value)).map(toKey),
);

describe('énumérations à source unique', () => {
  it('ne redéclare aucune énumération partagée dans un z.enum([...]) littéral', () => {
    const duplicates = sourceFiles(sourceRoot).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(LITERAL_ENUM)]
        .map((match) => (match[1] ?? '').match(/'([^']+)'/g)?.map((v) => v.slice(1, -1)) ?? [])
        .filter((values) => sharedEnumKeys.has(toKey(values)))
        .map((values) => `${path.relative(sourceRoot, file)} : ${values.join(', ')}`);
    });
    expect(duplicates).toEqual([]);
  });
});
