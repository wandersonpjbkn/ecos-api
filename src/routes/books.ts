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
  validateUpdateBook,
} from '@/middleware/validate.js'
import { Book } from '@/models/Book.js'
import { ReadingStatus, type ReadingStatusValue } from '@/models/ReadingStatus.js'
import type { AuthRequest } from '@/types/index.ts'
import { markBookEdit, PANEL_TRACKED, recordBookEdit } from '@/utils/bookEdit.js'
import {
  fetchEnrichmentPayload,
  getCoverSourceFromEnrichment,
} from '@/utils/enrichment.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

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


// ── GET /books — público ──────────────────────────────────────────
router.get('/', async (_req, res: Response) => {
  try {
    const books = await Book.find()
      .populate('autor', 'nome slug')
      .populate('categoria', 'nome slug')
      .populate('midia', 'nome slug')
      .populate('subgeneros', 'nome slug')
      .populate('quem_user_id', 'name')
      .sort({ added_at: -1 })
      .lean()

    res.json(books)
  } catch (err) {
    console.error('[GET /books]', err)
    handleDataError(res, err, 'Não deu pra carregar os livros. Tente de novo.')
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
      .populate('quem_user_id', 'name')
      .populate('added_by', 'name')
      .lean()

    if (!book) {
      res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
      return
    }

    res.json(book)
  } catch (err) {
    console.error('[GET /books/:id]', err)
    handleDataError(res, err, 'Não deu pra abrir o livro. Tente de novo.')
  }
})

// ── GET /books/:id/reading — público ─────────────────────────────
router.get('/:id/reading', validateObjectId('id'), async (req: AuthRequest, res: Response) => {
  // Only totals: who wants to read or has read a book is private to each person.
  try {
    const totals = await ReadingStatus.aggregate<{ _id: ReadingStatusValue; total: number }>([
      { $match: { book_id: new Types.ObjectId(String(req.params.id)) } },
      { $group: { _id: '$status', total: { $sum: 1 } } },
    ])
    const count = (status: ReadingStatusValue) => totals.find((t) => t._id === status)?.total ?? 0

    res.json({ quero_ler: count('quero_ler'), lido: count('lido') })
  } catch (err) {
    console.error('[GET /books/:id/reading]', err)
    handleDataError(res, err, 'Não deu pra carregar quem marcou este livro. Tente de novo.')
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
      const payload = normalizeBookInput(req.body)
      const book = await Book.create({ ...payload, added_by: req.user!._id, edit_history: [] })

      console.log(`[POST /books] "${book.titulo}" criado por ${req.user!.email}`)
      res.status(201).json(book)
    } catch (err) {
      console.error('[POST /books]', err)
      handleDataError(res, err, 'Não deu pra criar o livro. Tente de novo.')
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
      const marks = recordBookEdit(book, payload, user._id, PANEL_TRACKED)
      Object.assign(book, payload)
      markBookEdit(book, payload, marks)

      await book.save()
      res.json(book)
    } catch (err) {
      console.error('[PUT /books/:id]', err)
      handleDataError(res, err, 'Não deu pra salvar o livro. Tente de novo.')
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
      const marks = recordBookEdit(book, payload, user._id, PANEL_TRACKED)
      Object.assign(book, payload)
      markBookEdit(book, payload, marks)

      await book.save()

      console.log(`[PATCH /books/:id] "${book.titulo}" editado por ${user.email}`)
      res.json(book)
    } catch (err) {
      console.error('[PATCH /books/:id]', err)
      handleDataError(res, err, 'Não deu pra salvar o livro. Tente de novo.')
    }
  },
)

// ── POST /books/:id/enrich (preview) ─────────────────────────────
router.post(
  '/:id/enrich',
  authRateLimit,
  validateObjectId('id'),
  authenticate,
  enrichmentRateLimit,
  authorize('books', 'update'),
  async (req: AuthRequest, res: Response) => {
    try {
      const book = await Book.findById(req.params.id)
        .populate<{ autor: { nome: string } }>('autor', 'nome')
        .lean()

      if (!book) {
        res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
        return
      }


      const authorName =
        typeof book.autor === 'object' && book.autor && 'nome' in book.autor
          ? book.autor.nome
          : null
      if (!authorName) {
        res.status(400).json({ error: 'Falta o autor para procurar.' })
        return
      }

      const enrichment = await fetchEnrichmentPayload(book.titulo, authorName, book.isbn)
      if (!enrichment?.data) {
        res.status(404).json({ error: 'Não achamos capa nem dados para este livro.' })
        return
      }

      res.json({
        source: enrichment.source,
        preview: {
          description: enrichment.data.synopsis,
          coverUrl: enrichment.data.cover_url,
          publisher: enrichment.data.publisher,
          isbn: enrichment.data.isbn,
          pageCount: enrichment.data.page_count,
          publishedYear: enrichment.data.published_year,
          externalId: enrichment.data.google_books_id,
          strategy: enrichment.data.strategy,
        },
      })
    } catch (err) {
      console.error('[POST /books/:id/enrich]', err)
      handleDataError(res, err, 'Não deu pra buscar os dados do livro. Tente de novo.')
    }
  },
)

// ── POST /books/:id/enrich/apply ─────────────────────────────────
router.post(
  '/:id/enrich/apply',
  authRateLimit,
  validateObjectId('id'),
  authenticate,
  enrichmentRateLimit,
  authorize('books', 'update'),
  async (req: AuthRequest, res: Response) => {
    try {
      const fields = req.body?.fields
      const allowedFields = [
        'description',
        'coverUrl',
        'publisher',
        'isbn',
        'pageCount',
        'publishedYear',
      ]

      if (
        !Array.isArray(fields) ||
        fields.length === 0 ||
        fields.some((field) => !allowedFields.includes(field))
      ) {
        res.status(400).json({
          error: 'Marque o que você quer usar no livro.',
        })
        return
      }

      const book = await Book.findById(req.params.id).populate<{ autor: { nome: string } }>(
        'autor',
        'nome',
      )
      if (!book) {
        res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
        return
      }


      if (book.manually_edited_at) {
        res.status(409).json({
          error:
            'Este livro foi corrigido à mão; os dados automáticos não substituem essa correção.',
        })
        return
      }

      const authorName =
        typeof book.autor === 'object' && book.autor && 'nome' in book.autor
          ? book.autor.nome
          : null
      if (!authorName) {
        res.status(400).json({ error: 'Falta o autor para procurar.' })
        return
      }

      const enrichment = await fetchEnrichmentPayload(book.titulo, authorName, book.isbn)
      if (!enrichment?.data) {
        res.status(404).json({ error: 'Não achamos capa nem dados para este livro.' })
        return
      }

      const applyMap: Record<string, unknown> = {
        description: enrichment.data.synopsis,
        coverUrl: enrichment.data.cover_url,
        publisher: enrichment.data.publisher,
        isbn: enrichment.data.isbn,
        pageCount: enrichment.data.page_count,
        publishedYear: enrichment.data.published_year,
      }

      const payload: Record<string, unknown> = {}
      for (const field of fields) {
        if (applyMap[field] !== undefined) payload[field] = applyMap[field]
      }

      const normalizedPayload = normalizeBookInput(payload)
      Object.assign(book, normalizedPayload)
      book.google_books_id = enrichment.data.google_books_id
      book.enriched_at = new Date()

      if (normalizedPayload.cover_url !== undefined) {
        book.cover_source = getCoverSourceFromEnrichment(enrichment.source)
      }

      await book.save()

      res.json({
        message: 'Enriquecimento aplicado com sucesso.',
        source: enrichment.source,
        applied_fields: Object.keys(payload),
        book,
      })
    } catch (err) {
      console.error('[POST /books/:id/enrich/apply]', err)
      handleDataError(res, err, 'Não deu pra salvar os dados no livro. Tente de novo.')
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

      // A deleted book leaves no "Quero ler" / "Lido" pointing at nothing.
      await ReadingStatus.deleteMany({ book_id: book._id })

      console.log(`[DELETE /books/:id] "${book.titulo}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /books/:id]', err)
      handleDataError(res, err, 'Não deu pra remover o livro. Tente de novo.')
    }
  },
)

export default router
