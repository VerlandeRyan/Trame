import js from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import { defineConfig } from 'eslint/config'
import sonarjs from 'eslint-plugin-sonarjs'
import tseslint from 'typescript-eslint'

// Same rules as the API and the web: SonarJS (eslint-plugin-sonarjs) with typed lint.
export default defineConfig(
  { ignores: ['test-results/**', 'playwright-report/**', 'eslint.config.mjs'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, sonarjs.configs.recommended],
    plugins: { jsdoc },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    // Stable tests: wait for an observable state, never the network or a duration (they fail
    // on a loaded machine).
    rules: {
      // Documentation convention: every function and interface has a one-line description.
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'VariableDeclarator > ArrowFunctionExpression'],
        },
      ],
      'jsdoc/require-description': ['error', { contexts: ['any'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='waitForLoadState'][arguments.0.value='networkidle']",
          message:
            "`networkidle` n'attend que le réseau : utiliser `waitForHydration(page)` (support/hydration.ts).",
        },
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            'Pas de pause fixe : attendre une assertion ou une réponse (`expect`, `waitForResponse`).',
        },
      ],
    },
  },
  {
    // Documentation is not required in the journeys.
    files: ['tests/**/*.ts'],
    rules: { 'jsdoc/require-jsdoc': 'off', 'jsdoc/require-description': 'off' },
  },
)
