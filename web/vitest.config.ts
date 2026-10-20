import { defineVitestConfig } from '@nuxt/test-utils/config'

// Tests unitaires colocalisés (`foo.ts` + `foo.spec.ts`, `Foo.vue` + `Foo.spec.ts`) dans
// l'environnement Nuxt (auto-imports, i18n). Les parcours complets sont dans `e2e/`.
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['app/**/*.spec.ts', 'shared/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Le cache disque des modules transformés rend la 2e exécution invalide avec l'environnement
    // Nuxt (« Failed to resolve import … nuxt-vitest-app-entry.js »).
    fsModuleCache: false,
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['app/**/*.{ts,vue}', 'shared/**/*.ts'],
      // `useApi.ts` est un adaptateur sans logique (la logique testée est `utils/api-client.ts`).
      exclude: ['**/*.spec.ts', 'app/composables/useApi.ts'],
      // Seuil volontairement en dessous du niveau actuel (~90 %) : il bloque les régressions franches.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
})
