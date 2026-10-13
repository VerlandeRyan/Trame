import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Les tests partagent une même base : exécution en série.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Amorçage du processus (écoute, signaux) : aucune logique métier, exclu du calcul.
      exclude: ['src/server.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
