import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `.env` racine pour le développement local (sans écraser une variable déjà définie, ex. en CI).
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // Pas de .env : les variables viennent de l'environnement.
}

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
