import sonarjs from 'eslint-plugin-sonarjs'
import withNuxt from './.nuxt/eslint.config.mjs'

// Règles renforcées, reprises de hortibat_frontend pour garder des composants simples, et règles
// de SonarCloud (eslint-plugin-sonarjs) vérifiées avant le push ; lint typé pour que les règles
// qui lisent les types (promesses, `void`…) répondent comme dans l'analyse Sonar.
export default withNuxt(
  sonarjs.configs.recommended,
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        // Les fichiers de Vitest ne sont dans aucun tsconfig de Nuxt.
        projectService: { allowDefaultProject: ['vitest.config.ts', 'vitest.setup.ts'] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      // Aligné sur Prettier, qui écrit `<input />` (le formateur fait foi).
      'vue/html-self-closing': ['error', { html: { void: 'always' } }],
      'vue/max-props': ['error', { maxProps: 6 }],
      'vue/max-template-depth': ['error', { maxDepth: 8 }],
      'vue/no-ref-object-reactivity-loss': 'error',
      'vue/no-unused-properties': 'error',
      'vue/no-unused-refs': 'error',
      'vue/require-typed-ref': 'error',
    },
  },
)
