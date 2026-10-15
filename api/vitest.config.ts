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
    // Tests colocalisés : `foo.ts` + `foo.test.ts` dans le même dossier de `src/`.
    include: ['src/**/*.test.ts'],
    // Les tests partagent une même base : exécution en série.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Amorçage du processus (écoute, signaux) : aucune logique métier, exclu du calcul ; les
      // tests et leur support (`src/testing/`) ne sont pas du code à couvrir.
      exclude: ['src/server.ts', 'src/**/*.test.ts', 'src/testing/**'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
