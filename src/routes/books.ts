import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateBook, validateUpdateBook, validateObjectId } from '@/middleware/validate.js'
import { Book } from '@/models/Book.js'
import type { AuthRequest } from '@/types/index.ts'

const router = Router()

// ── GET /books — público ──────────────────────────────────────────
router.get('/', async (_req, res: Response) => {
  try {
    const books = await Book.find()
      .populate('autor', 'nome slug')
      .populate('categoria', 'nome slug')
      .populate('midia', 'nome slug')
      .populate('subgeneros', 'nome slug')
      .populate('quem_user_id', 'name avatar_url')
      .sort({ added_at: -1 })
      .lean()

    res.json(books)
  } catch (err) {
    console.error('[GET /books]', err)
    res.status(500).json({ error: 'Erro ao buscar livros.' })
  }
})

// ── GET /books/:id — público ──────────────────────────────────────
router.get('/:id', validateObjectId('id'), async (req: AuthRequest, res: Response) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate('autor', 'nome slug')
      .populate('categoria', 'nome slug')
      .populate('midia', 'nome slug')
      .populate('subgeneros', 'nome slug')
      .populate('quem_user_id', 'name avatar_url')
      .populate('added_by', 'name')
      .lean()

    if (!book) {
      res.status(404).json({ error: 'Livro não encontrado.' })
      return
    }

    res.json(book)
  } catch (err) {
    console.error('[GET /books/:id]', err)
    res.status(500).json({ error: 'Erro ao buscar livro.' })
  }
})

// ── POST /books ───────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('books', 'create'),
  validateCreateBook,
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.create({
        ...req.body,
        added_by: req.user!._id,
        edit_history: [],
      })

      console.log(`[POST /books] "${book.titulo}" criado por ${req.user!.email}`)
      res.status(201).json(book)
    } catch (err) {
      console.error('[POST /books]', err)
      res.status(500).json({ error: 'Erro ao criar livro.' })
    }
  },
)

// ── PATCH /books/:id ──────────────────────────────────────────────
router.patch(
  '/:id',
  validateObjectId('id'),
  authenticate,
  authorize('books', 'update'),
  validateUpdateBook,
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.findById(req.params.id)
      if (!book) {
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      const user = req.user!
      const isAdmin = user.role === 'admin'
      const isOwner = book.quem_user_id?.toString() === user._id.toString()

      if (!isAdmin && !isOwner) {
        res.status(403).json({ error: 'Você só pode editar suas próprias indicações.' })
        return
      }

      // Registra no edit_history apenas campos que mudaram
      const trackable = ['titulo', 'autor', 'categoria', 'midia', 'porque', 'isbn'] as const
      const now = new Date()

      for (const field of trackable) {
        if (req.body[field] !== undefined && req.body[field] !== String(book[field])) {
          book.edit_history.push({
            field,
            previous_value: String(book[field] ?? ''),
            edited_at: now,
            edited_by: user._id,
          })
        }
      }

      Object.assign(book, req.body)
      await book.save()

      console.log(`[PATCH /books/:id] "${book.titulo}" editado por ${user.email}`)
      res.json(book)
    } catch (err) {
      console.error('[PATCH /books/:id]', err)
      res.status(500).json({ error: 'Erro ao atualizar livro.' })
    }
  },
)

// ── DELETE /books/:id ─────────────────────────────────────────────
router.delete(
  '/:id',
  validateObjectId('id'),
  authenticate,
  authorize('books', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.findByIdAndDelete(req.params.id)
      if (!book) {
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      console.log(`[DELETE /books/:id] "${book.titulo}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /books/:id]', err)
      res.status(500).json({ error: 'Erro ao remover livro.' })
    }
  },
)

export default router
