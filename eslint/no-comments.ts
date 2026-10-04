import type { AST, Rule } from 'eslint'

export type CommentVerdict = 'allowed' | 'comment' | 'portuguese'

const DIRECTIVE =
  /^\s*(eslint-|global\s|@ts-|prettier-ignore|stylelint-|NOSONAR|istanbul\s|c8\s|@vite-ignore|[#@]__PURE__|\/\s*<reference)/
const DECORATION = new Set([...' \t\n─━=*#-'])
const SENTENCE = /[,;!?(){}='`]|\.(\s|$)|:(\s|$)|:\/\//
const ACCENT = /[à-öù-ü]/
const PORTUGUESE = new Set(
  'e de do da dos das com para sem pelo pela uma somente apenas voltar resumo bordas tipografia acesso leitura livro livros tela'.split(
    ' ',
  ),
)
const TITLE_MAX = 48

const undecorated = (text: string) => {
  let start = 0
  let end = text.length
  while (start < end && DECORATION.has(text[start]!)) start += 1
  while (end > start && DECORATION.has(text[end - 1]!)) end -= 1
  return text.slice(start, end)
}

const isPortuguese = (title: string) =>
  ACCENT.test(title) ||
  title
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((word) => PORTUGUESE.has(word))

export const judgeComment = (text: string, ownLine: boolean): CommentVerdict => {
  if (DIRECTIVE.test(text)) return 'allowed'
  const title = undecorated(text)
  if (!ownLine || text.startsWith('*') || text.includes('\n')) return 'comment'
  if (!title || title.length > TITLE_MAX) return 'comment'
  if (SENTENCE.test(title)) return 'comment'
  return isPortuguese(title) ? 'portuguese' : 'allowed'
}

type Commented = { value: string; loc?: AST.SourceLocation | null }

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      comment:
        'Comentário no código é proibido: só título de seção ou de bloco, curto, em uma linha só. O porquê vai no commit ou na doc.',
      portuguese: 'Título de seção em português: escreva em inglês.',
    },
  },
  create(context) {
    const { lines } = context.sourceCode
    const ownLine = (loc: AST.SourceLocation) =>
      !lines[loc.start.line - 1]!.slice(0, loc.start.column).trim() &&
      !lines[loc.end.line - 1]!.slice(loc.end.column).trim()

    const judge = ({ value, loc }: Commented) => {
      if (!loc) return
      const verdict = judgeComment(value, ownLine(loc))
      if (verdict !== 'allowed') context.report({ loc, messageId: verdict })
    }

    return {
      Program() {
        context.sourceCode.getAllComments().forEach(judge)
        const template = (context.sourceCode.ast as { templateBody?: { comments?: Commented[] } })
          .templateBody
        template?.comments?.forEach(judge)
      },
    }
  },
}

export default { rules: { 'no-comments': rule } }
