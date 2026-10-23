import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

// Règles de SonarCloud (eslint-plugin-sonarjs) vérifiées avant le push ; lint typé pour que les
// règles qui lisent les types (promesses, `void`…) répondent comme dans l'analyse Sonar.
export default defineConfig(
  { ignores: ['dist/**', 'dist-e2e/**', 'coverage/**', 'migrations/**', 'scripts/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, sonarjs.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Une propriété écartée par `...rest` n'est pas une variable oubliée.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'sonarjs/no-unused-vars': 'off',
    },
  },
  {
    // Tests : `.sort()` compare des ensembles sans ordre, une moyenne arrondie s'attend exacte et
    // le SQL d'insertion se construit en ligne.
    files: ['**/*.test.ts'],
    rules: {
      'sonarjs/no-alphabetical-sort': 'off',
      'sonarjs/no-misleading-array-reverse': 'off',
      'sonarjs/no-floating-point-equality': 'off',
      'sonarjs/no-nested-template-literals': 'off',
    },
  },
);
