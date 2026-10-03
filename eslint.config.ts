import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import sonarjs from 'eslint-plugin-sonarjs'
import prettier from 'eslint-config-prettier'

import englishNames from './eslint/english-names.ts'

export default defineConfig([
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'eslint/**/*.ts'],

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

  // Code and new database fields are named in English; the frozen lists are what already existed outside the code.
  {
    name: 'app/english-names',
    files: ['src/**/*.ts', 'tests/**/*.ts', 'eslint/**/*.ts'],
    plugins: { local: englishNames },
    rules: {
      'local/english-names': [
        'error',
        {
          legacyNames: [
            // Models over collections that already exist.
            'Autor',
            'AutorSchema',
            'IAutor',
            'Categoria',
            'CategoriaSchema',
            'ICategoria',
            'Midia',
            'MidiaSchema',
            'IMidia',
            'Subgenero',
            'SubgeneroSchema',
            'ISubgenero',
          ],
          legacyFields: [
            // Database and API fields.
            'titulo',
            'autor',
            'autores',
            'categoria',
            'categorias',
            'midia',
            'midias',
            'subgeneros',
            'nome',
            'porque',
            'quem_nome',
            'quem_user_id',
            'hidden_midias',
            'lido',
          ],
        },
      ],
    },
  },

  // RuleTester.run declares the cases, which sonarjs does not see as tests.
  {
    files: ['eslint/**/*.test.ts'],
    rules: { 'sonarjs/no-empty-test-file': 'off' },
  },

  // Complexity debt that predates sonarjs: warn here, error everywhere else.
  {
    files: [
      'src/middleware/validate.ts',
      'src/migrations/migrate-csv.ts',
      'src/utils/bookPerson.ts',
    ],
    rules: {
      'sonarjs/cognitive-complexity': 'warn',
    },
  },

  globalIgnores(['**/dist/**']),

  prettier,
])
