import { defineVitestConfig } from '@nuxt/test-utils/config'

// Colocated unit tests (`foo.ts` + `foo.spec.ts`, `Foo.vue` + `Foo.spec.ts`) in
// the Nuxt environment (auto-imports, i18n). Full journeys live in `e2e/`.
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['app/**/*.spec.ts', 'shared/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // The on-disk cache of transformed modules makes the 2nd run invalid with the Nuxt environment
    // ("Failed to resolve import … nuxt-vitest-app-entry.js").
    fsModuleCache: false,
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['app/**/*.{ts,vue}', 'shared/**/*.ts'],
      // `useApi.ts` is an adapter without logic (the tested logic is `utils/api-client.ts`).
      exclude: ['**/*.spec.ts', 'app/composables/useApi.ts', 'app/contract/api-schema.ts'],
      // Threshold deliberately below the current level (~90%): it blocks clear regressions.
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
})
