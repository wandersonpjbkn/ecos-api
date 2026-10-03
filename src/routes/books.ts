import { Router } from 'express'
import type { Response } from 'express'
import { Types } from 'mongoose'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { authRateLimit, enrichmentRateLimit } from '@/middleware/rateLimit.js'
import {
  validateCreateBook,
  validateObjectId,
  validateReplaceBook,
  validateBookSearch,
  validateUpdateBook,
} from '@/middleware/validate.js'
import { Book } from '@/models/Book.js'
import { ReadingStatus, type ReadingStatusValue } from '@/models/ReadingStatus.js'
import type { AuthRequest } from '@/types/index.ts'
import { isbnSourceOf, markBookEdit, PANEL_TRACKED, recordBookEdit } from '@/utils/bookEdit.js'
import { applyBookPerson, creditablePeople } from '@/utils/bookPerson.js'
import { searchCandidates } from '@/utils/enrichment.js'
import { handleDataError } from '@/utils/httpErrors.js'
import { publicBook } from '@/utils/publicBook.js'

const normalizeBookInput = (body: Record<string, unknown>): Record<string, unknown> => {
  const normalized = { ...body }

  if (normalized.coverUrl !== undefined) {
    normalized.cover_url = normalized.coverUrl
    delete normalized.coverUrl
  }
  if (normalized.coverSource !== undefined) {
    normalized.cover_source = normalized.coverSource
    delete normalized.coverSource
  }
  if (normalized.description !== undefined) {
    normalized.synopsis = normalized.description
    delete normalized.description
  }
  if (normalized.pageCount !== undefined) {
    normalized.page_count = normalized.pageCount
    delete normalized.pageCount
  }
  if (normalized.publishedYear !== undefined) {
    normalized.published_year = normalized.publishedYear
    delete normalized.publishedYear
  }

  return normalized
}

const router = Router()

// ── GET /books ──────────────────────────────────────────
router.get('/', async (_req, res: Response) => {
  try {
    const books = await Book.find()
      .populate('authors', 'nome slug')
      .populate('categoria', 'nome slug')
      .populate('midia', 'nome slug')
      .populate('subgeneros', 'nome slug')
      .populate('quem_user_id', 'name')
      .sort({ added_at: -1 })
      .lean()

    res.set('Cache-Control', 'no-cache')
    res.json(books.map(publicBook))
  } catch (err) {
    console.error('[GET /books]', err)
    handleDataError(res, err, 'Não foi possível carregar os livros. Tente de novo.')
  }
})

// ── GET /books/people ──
router.get(
  '/people',
  authenticate,
  authorize('books', 'create'),
  async (_req: AuthRequest, res: Response) => {
    try {
      res.json(await creditablePeople())
    } catch (err) {
      handleDataError(res, err, 'Não foi possível carregar a lista de pessoas. Tente de novo.')
    }
  },
)

// ── POST /books/enrich/search ─────────────────────────────────────
router.post(
  '/enrich/search',
  authRateLimit,
  authenticate,
  enrichmentRateLimit,
  authorize('books', ['create', 'update']),
  validateBookSearch,
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, author, isbn } = req.body as { title: string; author: string; isbn?: string }
      const found = await searchCandidates(title.trim(), author.trim(), isbn?.trim() || undefined)
      if (found.failed) {
        res.status(503).json({
          error: 'A busca de capa e dados não respondeu. Tente de novo em alguns minutos.',
        })
        return
      }
      res.json({ source: found.source, candidates: found.candidates })
    } catch (err) {
      console.error('[POST /books/enrich/search]', err)
      handleDataError(res, err, 'Não foi possível buscar agora. Tente de novo.')
    }
  },
)

// ── GET /books/:id ──────────────────────────────────────
router.get('/:id', validateObjectId('id'), async (req: AuthRequest, res: Response) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate('authors', 'nome slug')
      .populate('categoria', 'nome slug')
      .populate('midia', 'nome slug')
      .populate('subgeneros', 'nome slug')
      .populate('quem_user_id', 'name')
      .lean()

    if (!book) {
      res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
      return
    }

    res.json(publicBook(book))
  } catch (err) {
    console.error('[GET /books/:id]', err)
    handleDataError(res, err, 'Não foi possível abrir o livro. Tente de novo.')
  }
})

// ── GET /books/:id/reading ─────────────────────────────
router.get('/:id/reading', validateObjectId('id'), async (req: AuthRequest, res: Response) => {
  try {
    const totals = await ReadingStatus.aggregate<{ _id: ReadingStatusValue; total: number }>([
      { $match: { book_id: new Types.ObjectId(String(req.params.id)) } },
      { $group: { _id: '$status', total: { $sum: 1 } } },
    ])
    const count = (status: ReadingStatusValue) => totals.find((t) => t._id === status)?.total ?? 0

    res.json({ quero_ler: count('quero_ler'), lido: count('lido') })
  } catch (err) {
    console.error('[GET /books/:id/reading]', err)
    handleDataError(res, err, 'Não foi possível carregar quem marcou este livro. Tente de novo.')
  }
})

// ── POST /books ───────────────────────────────────────────────────
router.post(
  '/',
  authRateLimit,
  authenticate,
  authorize('books', 'create'),
  validateCreateBook,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!
      const payload = normalizeBookInput(req.body)
      payload.isbn_source = payload.isbn ? isbnSourceOf(payload) : undefined
      await applyBookPerson(payload, user)
      const book = await Book.create({ ...payload, added_by: user._id, edit_history: [] })

      console.log(`[POST /books] "${book.titulo}" criado por ${req.user!.email}`)
      res.status(201).json(publicBook(book.toObject()))
    } catch (err) {
      console.error('[POST /books]', err)
      handleDataError(res, err, 'Não foi possível criar o livro. Tente de novo.')
    }
  },
)

// ── PUT /books/:id ────────────────────────────────────────────────
router.put(
  '/:id',
  authRateLimit,
  validateObjectId('id'),
  authenticate,
  authorize('books', 'update'),
  validateReplaceBook,
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.findById(req.params.id)
      if (!book) {
        res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
        return
      }

      const payload = normalizeBookInput(req.body)
      const user = req.user!
      await applyBookPerson(payload, user, book)
      const marks = recordBookEdit(book, payload, user._id, PANEL_TRACKED)
      Object.assign(book, payload)
      markBookEdit(book, payload, marks)

      await book.save()
      res.json(publicBook(book.toObject()))
    } catch (err) {
      console.error('[PUT /books/:id]', err)
      handleDataError(res, err, 'Não foi possível salvar o livro. Tente de novo.')
    }
  },
)

// ── PATCH /books/:id ──────────────────────────────────────────────
router.patch(
  '/:id',
  authRateLimit,
  validateObjectId('id'),
  authenticate,
  authorize('books', 'update'),
  validateUpdateBook,
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.findById(req.params.id)
      if (!book) {
        res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
        return
      }

      const user = req.user!
      const payload = normalizeBookInput(req.body)
      await applyBookPerson(payload, user, book)
      const marks = recordBookEdit(book, payload, user._id, PANEL_TRACKED)
      Object.assign(book, payload)
      markBookEdit(book, payload, marks)

      await book.save()

      console.log(`[PATCH /books/:id] "${book.titulo}" editado por ${user.email}`)
      res.json(publicBook(book.toObject()))
    } catch (err) {
      console.error('[PATCH /books/:id]', err)
      handleDataError(res, err, 'Não foi possível salvar o livro. Tente de novo.')
    }
  },
)

// ── DELETE /books/:id ─────────────────────────────────────────────
router.delete(
  '/:id',
  authRateLimit,
  validateObjectId('id'),
  authenticate,
  authorize('books', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.findByIdAndDelete(req.params.id)
      if (!book) {
        res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
        return
      }

      await ReadingStatus.deleteMany({ book_id: book._id })

      console.log(`[DELETE /books/:id] "${book.titulo}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /books/:id]', err)
      handleDataError(res, err, 'Não foi possível remover o livro. Tente de novo.')
    }
  },
)

export default router
