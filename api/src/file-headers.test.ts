/** Documentation convention check: every source file starts with a one-line description comment. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = path.dirname(fileURLToPath(import.meta.url));
/** Files that are generated or are tests: not commented element by element. */
const EXEMPT = /\.test\.ts$|[\\/]generated\.ts$/;

/** Lists the TypeScript files under a folder, recursively. */
function listSourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    return entry.name.endsWith('.ts') && !EXEMPT.test(entryPath) ? [entryPath] : [];
  });
}

describe('file headers', () => {
  const files = listSourceFiles(SOURCE_ROOT);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((file) => [path.relative(SOURCE_ROOT, file), file]))(
    '%s starts with a description comment',
    (_name, file) => {
      const firstLine = readFileSync(file as string, 'utf8')
        .trimStart()
        .split(/\r?\n/, 1)[0];
      expect(firstLine).toMatch(/^\/\*\*/);
    },
  );
});
