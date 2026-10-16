// @ts-check
import eslintJs from '@eslint/js';
import globals from 'globals';
import tsEslint from 'typescript-eslint';

export default tsEslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'],
  },

  eslintJs.configs.recommended,
  tsEslint.configs.recommended,

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      // Underscore prefix marks intentionally unused bindings (same convention
      // tsc's noUnusedLocals/noUnusedParameters accept).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      // Pre-existing violations at adoption time; downgraded so `npm run lint`
      // gates new errors without a mass edit. Raise back to 'error' once fixed.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    files: ['src/**/__tests__/**/*.ts'],
    languageOptions: {
      globals: globals.vitest,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
