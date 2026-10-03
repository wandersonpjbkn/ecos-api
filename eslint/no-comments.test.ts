import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'

import noComments, { judgeComment } from './no-comments.js'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } })
const comment = [{ messageId: 'comment' }]
const portuguese = [{ messageId: 'portuguese' }]

tester.run('no-comments', noComments.rules['no-comments'], {
  valid: [
    { code: '// ── Routes ──────────\nconst a = 1' },
    { code: '// ── GET /books/:id ──\nrouter.get()' },
    { code: '// Helpers\nconst a = 1' },
    { code: '/* ── Reset ── */\nconst a = 1' },
    { code: '// eslint-disable-next-line no-console -- startup log\nconsole.log(1)' },
    { code: '/* eslint-disable no-console */\nconst a = 1' },
    { code: '// @ts-expect-error untyped library\nconst a = lib()' },
    { code: '// prettier-ignore\nconst a = [1,2]' },
  ],
  invalid: [
    { code: '// The catalog is one list for every screen.\nconst a = 1', errors: comment },
    { code: '// Phone only.\nconst a = 1', errors: comment },
    { code: '// refs: Autor, Midia\nconst a = 1', errors: comment },
    { code: 'const a = 10 * 60 * 1000 // 10 min', errors: comment },
    { code: '/**\n * Resolves the session.\n */\nconst a = 1', errors: comment },
    { code: '/** Up to five books */\nconst a = 1', errors: comment },
    { code: '// Footer (multi only)\nconst a = 1', errors: comment },
    { code: "// import.meta.env.VITE_ENV === 'production'\nconst a = 1", errors: comment },
    { code: '// https://vite.dev/config/\nconst a = 1', errors: comment },
    { code: '// ── Normalização ApiBook → Book ──\nconst a = 1', errors: portuguese },
    { code: '// Header e Globais\nconst a = 1', errors: portuguese },
    { code: '// Validações\nconst a = 1', errors: portuguese },
    { code: '// Voltar\nconst a = 1', errors: portuguese },
  ],
})

describe('judgeComment', () => {
  it('keeps a short title on its own line', () => {
    expect(judgeComment(' ── Composable ── ', true)).toBe('allowed')
  })

  it('refuses a title at the end of a line of code', () => {
    expect(judgeComment(' Loading ', false)).toBe('comment')
  })

  it('refuses a title spread over lines', () => {
    expect(judgeComment('\n Loading\n ', true)).toBe('comment')
  })

  it('refuses a title past the length of a title', () => {
    expect(judgeComment(' Options and their counts over the whole catalog today ', true)).toBe(
      'comment',
    )
  })
})
