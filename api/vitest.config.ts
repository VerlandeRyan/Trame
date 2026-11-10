import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Root `.env` for local development (without overriding a variable already set, e.g. in CI).
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env: the variables come from the environment.
}

export default defineConfig({
  test: {
    // Colocated tests: `foo.ts` + `foo.test.ts` in the same `src/` folder.
    include: ['src/**/*.test.ts'],
    // Tests share one database: run them serially.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Process bootstrap (listening, signals): no business logic, excluded from the count; the
      // tests and their support (`src/testing/`) are not code to cover.
      exclude: [
        'src/server.ts',
        'src/server.e2e.ts',
        'src/bootstrap.ts',
        'src/backup/run-backup.ts',
        'src/openapi/export.ts',
        'src/db/generated.ts',
        'src/**/*.test.ts',
        'src/testing/**',
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
