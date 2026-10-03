import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import sonarjs from 'eslint-plugin-sonarjs'
import prettier from 'eslint-config-prettier'

import englishNames from './eslint/english-names.ts'
import noComments from './eslint/no-comments.ts'

const local = { rules: { ...englishNames.rules, ...noComments.rules } }

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

  {
    name: 'app/english-names',
    files: ['src/**/*.ts', 'tests/**/*.ts', 'eslint/**/*.ts'],
    plugins: { local },
    rules: {
      'local/english-names': [
        'error',
        {
          legacyNames: [
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

  {
    name: 'app/no-comments',
    files: ['src/**/*.{ts,mts}', 'tests/**/*.ts', 'eslint/**/*.ts', 'scripts/**/*.mjs', '*.config.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { local },
    rules: { 'local/no-comments': 'error' },
  },

  {
    files: ['eslint/**/*.test.ts'],
    rules: { 'sonarjs/no-empty-test-file': 'off' },
  },

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
