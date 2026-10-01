import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '@/types/index.ts'

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isObjectId = (v: unknown): boolean => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v)
const isOptionalString = (v: unknown): boolean =>
  v === undefined || v === null || typeof v === 'string'

// ── Books ─────────────────────────────────────────────────────────

type BookField = keyof typeof FIELD

// How a field is named on screen: the API answers in the words the reader sees, never the raw field name.
const FIELD = {
  titulo: 'o título',
  authors: 'o autor',
  categoria: 'o gênero',
  midia: 'o formato',
  quem_nome: 'quem mencionou',
  quem_user_id: 'quem mencionou',
  subgeneros: 'os subgêneros',
  porque: 'o comentário',
  synopsis: 'a sinopse',
  isbn: 'o ISBN',
  cover_url: 'a capa',
  cover_source: 'a origem da capa',
  google_books_id: 'o código do Google Books',
  publisher: 'a editora',
  page_count: 'o número de páginas',
  published_year: 'o ano',
} as const

// Older clients send these names; normalizeBookInput maps them before saving.
const ALIAS: Record<string, BookField> = {
  description: 'synopsis',
  coverUrl: 'cover_url',
  coverSource: 'cover_source',
  pageCount: 'page_count',
  publishedYear: 'published_year',
}

const REQUIRED_TEXT: BookField[] = ['titulo']
const IDS: BookField[] = ['categoria', 'midia']
const isIdList = (v: unknown): v is unknown[] => Array.isArray(v) && v.every(isObjectId)
const OPTIONAL_TEXT: BookField[] = [
  'porque',
  'synopsis',
  'isbn',
  'cover_url',
  'google_books_id',
  'publisher',
]
const POSITIVE_INT: BookField[] = ['page_count', 'published_year']

const ADMIN_FIELDS = [...Object.keys(FIELD), ...Object.keys(ALIAS)]
// The owner edits every field of the book except who mentioned it and where the cover came from.
const MEMBER_FIELDS = Object.keys(FIELD).filter(
  (field) => !['quem_nome', 'quem_user_id', 'cover_source'].includes(field),
)

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The one check for a book's fields, shared by create, replace and both edit routes; returns the sentence to show. */
const bookFieldsError = (
  body: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly BookField[],
): string | null => {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    console.warn('[validate] book fields not allowed:', unknown.join(', '))
    return 'Não foi possível salvar o livro. Tente de novo.'
  }

  const value = (field: BookField) =>
    body[field] ?? body[Object.keys(ALIAS).find((alias) => ALIAS[alias] === field) ?? '']

  const filled = (field: BookField) => {
    // An empty or malformed list gets its own sentence below.
    if (field === 'authors') return value(field) !== undefined
    return IDS.includes(field) ? isObjectId(value(field)) : isString(value(field))
  }
  for (const field of required) {
    if (!filled(field)) return `Falta ${FIELD[field]}.`
  }
  for (const field of REQUIRED_TEXT) {
    if (value(field) !== undefined && !isString(value(field))) return `Falta ${FIELD[field]}.`
  }
  for (const field of IDS) {
    if (value(field) !== undefined && !isObjectId(value(field)))
      return `${capitalize(FIELD[field])} não é válido.`
  }
  // Who mentioned: an account id or a placeholder name, both optional (a new book defaults to whoever adds it).
  const userId = body.quem_user_id
  if (userId !== undefined && userId !== null && userId !== '' && !isObjectId(userId))
    return 'Escolha alguém da lista.'
  if (!isOptionalString(body.quem_nome)) return 'Escolha alguém da lista.'
  const { authors, subgeneros: subgenres } = body
  if (authors !== undefined) {
    if (!isIdList(authors)) return 'Algum autor não é válido.'
    if (authors.length === 0) return 'Falta o autor.'
    if (new Set(authors).size !== authors.length) return 'O mesmo autor está duas vezes.'
  }
  if (subgenres !== undefined && !isIdList(subgenres)) return 'Algum subgênero não é válido.'
  for (const field of OPTIONAL_TEXT) {
    if (!isOptionalString(value(field))) return `${capitalize(FIELD[field])} precisa ser um texto.`
  }
  for (const field of POSITIVE_INT) {
    const number = value(field)
    if (
      number !== undefined &&
      number !== null &&
      !(Number.isInteger(number) && (number as number) > 0)
    ) {
      return `${capitalize(FIELD[field])} precisa ser um número inteiro maior que zero.`
    }
  }
  const source = value('cover_source')
  if (source !== undefined && !['manual', 'google', 'openlibrary'].includes(source as string)) {
    return 'A origem da capa não é válida.'
  }
  return null
}

const bookValidator =
  (allowed: readonly string[], required: readonly BookField[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const error = bookFieldsError(req.body, allowed, required)
    if (error) {
      res.status(400).json({ error })
      return
    }
    next()
  }

export const validateCreateBook = bookValidator(ADMIN_FIELDS, [
  'titulo',
  'authors',
  'categoria',
  'midia',
])
export const validateReplaceBook = bookValidator(ADMIN_FIELDS, [
  'titulo',
  'authors',
  'categoria',
  'midia',
])
export const validateUpdateBook = bookValidator(ADMIN_FIELDS, [])
export const validateMemberUpdateBook = bookValidator(MEMBER_FIELDS, [])

// ── Users ─────────────────────────────────────────────────────────

export const validateUpdateRole = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const { role } = req.body
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'Esse nível não existe.' })
    return
  }
  next()
}

export const validateUpdateStatus = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const { status } = req.body
  if (!['active', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Essa opção de acesso não existe.' })
    return
  }
  next()
}

// ── Entidades de catálogo (Autor, Midia, Categoria, Subgenero) ────

export const validateCreateNamed = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const { nome } = req.body
  if (!isString(nome)) {
    res.status(400).json({ error: 'Falta o nome.' })
    return
  }
  if (nome.trim().length > 60) {
    res.status(400).json({ error: 'O nome pode ter até 60 letras.' })
    return
  }
  next()
}
// ── Params ────────────────────────────────────────────────────────

export const validateObjectId =
  (param: string) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!isObjectId(req.params[param])) {
      res.status(400).json({ error: 'Esse endereço não existe.' })
      return
    }
    next()
  }
