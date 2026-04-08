import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '@/types/index.ts'

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isObjectId = (v: unknown): boolean => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v)

// ── Books ─────────────────────────────────────────────────────────

export const validateCreateBook = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { titulo, autor, categoria, midia, quem_nome } = req.body

  if (!isString(titulo))     { res.status(400).json({ error: 'titulo é obrigatório.' }); return }
  if (!isString(autor))      { res.status(400).json({ error: 'autor é obrigatório.' }); return }
  if (!isString(categoria))  { res.status(400).json({ error: 'categoria é obrigatória.' }); return }
  if (!isString(quem_nome))  { res.status(400).json({ error: 'quem_nome é obrigatório.' }); return }
  if (!['Livro', 'Mangá', 'HQ'].includes(midia)) {
    res.status(400).json({ error: 'midia deve ser Livro, Mangá ou HQ.' })
    return
  }

  next()
}

export const validateUpdateBook = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const allowed = ['titulo', 'autor', 'categoria', 'midia', 'subgeneros', 'quem_nome', 'porque', 'isbn']
  const keys = Object.keys(req.body)

  const unknown = keys.filter((k) => !allowed.includes(k))
  if (unknown.length > 0) {
    res.status(400).json({ error: `Campos não permitidos: ${unknown.join(', ')}.` })
    return
  }

  if (req.body.midia && !['Livro', 'Mangá', 'HQ'].includes(req.body.midia)) {
    res.status(400).json({ error: 'midia deve ser Livro, Mangá ou HQ.' })
    return
  }

  next()
}

// ── Users ─────────────────────────────────────────────────────────

export const validateUpdateRole = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { role } = req.body

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'role deve ser admin, editor ou viewer.' })
    return
  }

  next()
}

// ── Subgeneros ────────────────────────────────────────────────────

export const validateCreateSubgenero = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
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

// ── Params ────────────────────────────────────────────────────────

export const validateObjectId = (param: string) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!isObjectId(req.params[param])) {
      res.status(400).json({ error: `${param} inválido.` })
      return
    }
    next()
  }
