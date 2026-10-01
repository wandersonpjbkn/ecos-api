import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import sonarjs from 'eslint-plugin-sonarjs'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],

    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },

    extends: [js.configs.recommended, ...tseslint.configs.recommended, sonarjs.configs.recommended],

    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },

    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal'],
          alphabetize: { order: 'asc' },
        },
      ],
    },
  },

  // Complexity debt that predates sonarjs: warn here, error everywhere else.
  {
    files: [
      'src/middleware/validate.ts',
      'src/migrations/migrate-csv.ts',
      'src/routes/admin.ts',
      'src/utils/bookPerson.ts',
    ],
    rules: {
      'sonarjs/cognitive-complexity': 'warn',
    },
  },

  globalIgnores(['**/dist/**']),

  prettier,
])
