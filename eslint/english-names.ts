import type { Rule } from 'eslint'

const PORTUGUESE = new Set(
  `livro livros autor autores autora categoria categorias genero generos subgenero subgeneros midia midias formato
  formatos titulo titulos nome nomes quem porque leitura leituras lido lidos prateleira prateleiras estante membro
  membros vinculo vinculos permissao permissoes capa capas sinopse editora catalogo acervo pessoa pessoas usuario
  usuarios busca buscar filtro filtros tamanho pagina paginas lista listas conta contas aparelho dados clube grupo
  mencionado mencionados comentario comentarios marcador dono donos destaque destaques favorito favoritos historico
  quantidade erro erros aviso avisos ajuda suporte painel exemplo valor valores texto textos hoje ontem semana
  proximo primeiro ultimo atual criar criado criada atualizar apagar adicionar salvar editar limpar
  escolher escolhido mostrar esconder oculto ocultos novo nova novos imagem imagens resultado resultados contagem
  ano tema cor botao campo campos formulario tela telas inicio voce meus minha minhas meu mais menos
  marcar desmarcar entrar sair vincular reivindicar sugestao indicado`.split(/\s+/),
)

const words = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|[\s_$-]+/)
    .map((word) => word.toLowerCase())

type Options = { legacyNames?: string[]; legacyFields?: string[] }

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          legacyNames: { type: 'array', items: { type: 'string' } },
          legacyFields: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      portuguese:
        '"{{name}}" tem palavra em português ({{word}}). Código e campo novo no banco nascem em inglês; português só no conteúdo.',
    },
  },
  create(context) {
    const { legacyNames = [], legacyFields = [] } = (context.options[0] ?? {}) as Options
    const names = new Set(legacyNames)
    const fields = new Set(legacyFields)

    const check = (node: Rule.Node | undefined | null, allowed: Set<string>) => {
      if (!node) return
      let name: string | null = null
      if (node.type === 'Identifier') name = node.name
      else if (node.type === 'Literal' && typeof node.value === 'string') name = node.value
      if (!name || allowed.has(name)) return
      const word = words(name).find((part) => PORTUGUESE.has(part))
      if (word) context.report({ node, messageId: 'portuguese', data: { name, word } })
    }

    const checkPattern = (node: Rule.Node | null | undefined): void => {
      if (!node) return
      if (node.type === 'Identifier') return check(node, names)
      if (node.type === 'AssignmentPattern') return checkPattern(node.left as Rule.Node)
      if (node.type === 'RestElement') return checkPattern(node.argument as Rule.Node)
      if (node.type === 'ArrayPattern')
        return node.elements.forEach((element) => checkPattern(element as Rule.Node))
      if (node.type !== 'ObjectPattern') return
      for (const prop of node.properties) {
        if (prop.type === 'RestElement') checkPattern(prop.argument as Rule.Node)
        else if (prop.shorthand)
          check(
            prop.value.type === 'AssignmentPattern'
              ? (prop.value.left as Rule.Node)
              : (prop.value as Rule.Node),
            fields,
          )
        else checkPattern(prop.value as Rule.Node)
      }
    }

    const checkFunction = (node: Rule.Node & { id?: unknown; params: unknown[] }) => {
      check(node.id as Rule.Node, names)
      node.params.forEach((param) => checkPattern(param as Rule.Node))
    }

    return {
      VariableDeclarator: (node) => checkPattern(node.id as Rule.Node),
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      ClassDeclaration: (node) => check(node.id as Rule.Node, names),
      CatchClause: (node) => checkPattern(node.param as Rule.Node),
      Property: (node) => {
        if (node.parent.type === 'ObjectExpression' && !node.computed && !node.shorthand)
          check(node.key as Rule.Node, fields)
      },
      MethodDefinition: (node) => check(node.key as Rule.Node, names),
      'TSInterfaceDeclaration, TSTypeAliasDeclaration, TSEnumDeclaration': (node: Rule.Node) =>
        check((node as unknown as { id: Rule.Node }).id, names),
      TSPropertySignature: (node: Rule.Node) =>
        check((node as unknown as { key: Rule.Node }).key, fields),
      TSEnumMember: (node: Rule.Node) => check((node as unknown as { id: Rule.Node }).id, fields),
    }
  },
}

export default { rules: { 'english-names': rule } }
