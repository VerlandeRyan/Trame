import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import { defineConfig } from 'eslint/config';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

// SonarCloud rules (eslint-plugin-sonarjs) checked before pushing; typed lint so the
// rules that read types (promises, `void`…) answer as in the Sonar analysis.
export default defineConfig(
  { ignores: ['dist/**', 'dist-e2e/**', 'coverage/**', 'migrations/**', 'scripts/**', 'src/db/generated.ts'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, sonarjs.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { jsdoc },
    rules: {
      // A property dropped by `...rest` is not a forgotten variable.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'sonarjs/no-unused-vars': 'off',
      // Documentation convention: every function, interface and class has a one-line description.
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'VariableDeclarator > ArrowFunctionExpression'],
        },
      ],
      'jsdoc/require-description': ['error', { contexts: ['any'] }],
    },
  },
  {
    // Tests: `.sort()` compares sets without order, a rounded average is expected exact and
    // the insertion SQL is built inline. Documentation is not required there.
    files: ['**/*.test.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-description': 'off',
      'sonarjs/no-alphabetical-sort': 'off',
      'sonarjs/no-misleading-array-reverse': 'off',
      'sonarjs/no-floating-point-equality': 'off',
      'sonarjs/no-nested-template-literals': 'off',
    },
  },
);
