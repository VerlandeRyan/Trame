import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import sonarjs from 'eslint-plugin-sonarjs'
import tseslint from 'typescript-eslint'

// Mêmes règles que l'API et le web : SonarJS (eslint-plugin-sonarjs) en lint typé.
export default defineConfig(
  { ignores: ['test-results/**', 'playwright-report/**', 'eslint.config.mjs'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, sonarjs.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
)
