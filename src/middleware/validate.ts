import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '@/types/index.ts'

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isObjectId = (v: unknown): boolean => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v)
const isOptionalString = (v: unknown): boolean => v === undefined || v === null || typeof v === 'string'

// ── Books ─────────────────────────────────────────────────────────

export const validateCreateBook = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const { titulo, autor, categoria, midia, quem_nome } = req.body

  if (!isString(titulo)) {
    res.status(400).json({ error: 'titulo é obrigatório.' })
    return
  }
  if (!isObjectId(autor)) {
    res.status(400).json({ error: 'autor deve ser um ObjectId válido.' })
    return
  }
  if (!isObjectId(categoria)) {
    res.status(400).json({ error: 'categoria deve ser um ObjectId válido.' })
    return
  }
  if (!isObjectId(midia)) {
    res.status(400).json({ error: 'midia deve ser um ObjectId válido.' })
    return
  }
  if (!isString(quem_nome)) {
    res.status(400).json({ error: 'quem_nome é obrigatório.' })
    return
  }

  next()
}

export const validateUpdateBook = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const allowed = [
    'titulo',
    'autor',
    'categoria',
    'midia',
    'subgeneros',
    'quem_nome',
    'porque',
    'isbn',
    'cover_url',
    'cover_source',
    'synopsis',
    'publisher',
    'page_count',
    'published_year',
    'google_books_id',
    'description',
    'coverUrl',
    'coverSource',
    'pageCount',
    'publishedYear',
  ]

  const unknown = Object.keys(req.body).filter((k) => !allowed.includes(k))
  if (unknown.length > 0) {
    res.status(400).json({ error: `Campos não permitidos: ${unknown.join(', ')}.` })
    return
  }

  for (const field of ['autor', 'categoria', 'midia'] as const) {
    if (req.body[field] !== undefined && !isObjectId(req.body[field])) {
      res.status(400).json({ error: `${field} deve ser um ObjectId válido.` })
      return
    }
  }

  if (req.body.subgeneros !== undefined) {
    if (!Array.isArray(req.body.subgeneros) || req.body.subgeneros.some((id: unknown) => !isObjectId(id))) {
      res.status(400).json({ error: 'subgeneros deve ser uma lista de ObjectIds válidos.' })
      return
    }
  }

  if (req.body.cover_source !== undefined && !['manual', 'google', 'openlibrary'].includes(req.body.cover_source)) {
    res.status(400).json({ error: 'cover_source deve ser manual, google ou openlibrary.' })
    return
  }

  if (req.body.coverSource !== undefined && !['manual', 'google', 'openlibrary'].includes(req.body.coverSource)) {
    res.status(400).json({ error: 'coverSource deve ser manual, google ou openlibrary.' })
    return
  }

  if (!isOptionalString(req.body.cover_url) || !isOptionalString(req.body.coverUrl)) {
    res.status(400).json({ error: 'cover_url/coverUrl deve ser string.' })
    return
  }

  if (!isOptionalString(req.body.synopsis) || !isOptionalString(req.body.description)) {
    res.status(400).json({ error: 'synopsis/description deve ser string.' })
    return
  }

  next()
}

export const validateReplaceBook = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const requiredObjectIds = ['autor', 'categoria', 'midia']
  const requiredStrings = ['titulo', 'quem_nome']

  for (const field of requiredStrings) {
    if (!isString(req.body[field])) {
      res.status(400).json({ error: `${field} é obrigatório.` })
      return
    }
  }

  for (const field of requiredObjectIds) {
    if (!isObjectId(req.body[field])) {
      res.status(400).json({ error: `${field} deve ser um ObjectId válido.` })
      return
    }
  }

  validateUpdateBook(req, res, next)
}

// ── Users ─────────────────────────────────────────────────────────

export const validateUpdateRole = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const { role } = req.body
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'role deve ser admin, editor ou viewer.' })
    return
  }
  next()
}

// ── Entidades de catálogo (Autor, Midia, Categoria, Subgenero) ────
// Validação compartilhada — só nome obrigatório, máx 60 chars

export const validateCreateNamed = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const { nome } = req.body
  if (!isString(nome)) {
    res.status(400).json({ error: 'nome é obrigatório.' })
    return
  }
  if (nome.trim().length > 60) {
    res.status(400).json({ error: 'nome deve ter no máximo 60 caracteres.' })
    return
  }
  next()
}

// Mantido por compatibilidade com importações existentes em subgeneros.ts
export const validateCreateSubgenero = validateCreateNamed

// ── Params ────────────────────────────────────────────────────────

export const validateObjectId =
  (param: string) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!isObjectId(req.params[param])) {
      res.status(400).json({ error: `${param} inválido.` })
      return
    }
    next()
  }
