import { Router } from 'express'
import type { Response } from 'express'

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
import type { AuthRequest } from '@/types/index.ts'
import { fetchEnrichmentPayload, getCoverSourceFromEnrichment } from '@/utils/enrichment.js'
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

const ensureCanEdit = (req: AuthRequest, res: Response, ownerUserId?: string): boolean => {
  const user = req.user!
  const isAdmin = user.role === 'admin'
  const isOwner = ownerUserId !== undefined && ownerUserId === user._id.toString()

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: 'Você só pode editar suas próprias indicações.' })
    return false
  }

  return true
}

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
    handleDataError(res, err, 'Erro ao buscar livros.')
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
    handleDataError(res, err, 'Erro ao buscar livro.')
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

      const book = await Book.create({
        ...payload,
        added_by: req.user!._id,
        edit_history: [],
      })

      console.log(`[POST /books] "${book.titulo}" criado por ${req.user!.email}`)
      res.status(201).json(book)
    } catch (err) {
      console.error('[POST /books]', err)
      handleDataError(res, err, 'Erro ao criar livro.')
    }
  },
)

// ── PUT /books/:id ───────────────────────────────────────────────
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
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      if (!ensureCanEdit(req, res, book.quem_user_id?.toString())) {
        return
      }

      const payload = normalizeBookInput(req.body)
      const user = req.user!
      const now = new Date()
      const trackable = [
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
      ] as const

      for (const field of trackable) {
        if (payload[field] !== undefined && String(payload[field]) !== String(book[field])) {
          book.edit_history.push({
            field,
            previous_value: String(book[field] ?? ''),
            edited_at: now,
            edited_by: user._id,
          })
        }
      }

      Object.assign(book, payload)
      book.manually_edited_at = now
      if (payload.cover_url !== undefined) {
        book.cover_source = 'manual'
      }

      await book.save()
      res.json(book)
    } catch (err) {
      console.error('[PUT /books/:id]', err)
      handleDataError(res, err, 'Erro ao substituir livro.')
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
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      if (!ensureCanEdit(req, res, book.quem_user_id?.toString())) {
        return
      }

      const user = req.user!
      const now = new Date()
      const payload = normalizeBookInput(req.body)

      const trackable = [
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
      ] as const

      for (const field of trackable) {
        if (payload[field] !== undefined && String(payload[field]) !== String(book[field])) {
          book.edit_history.push({
            field,
            previous_value: String(book[field] ?? ''),
            edited_at: now,
            edited_by: user._id,
          })
        }
      }

      Object.assign(book, payload)
      book.manually_edited_at = now
      if (payload.cover_url !== undefined) {
        book.cover_source = 'manual'
      }

      await book.save()

      console.log(`[PATCH /books/:id] "${book.titulo}" editado por ${user.email}`)
      res.json(book)
    } catch (err) {
      console.error('[PATCH /books/:id]', err)
      handleDataError(res, err, 'Erro ao atualizar livro.')
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
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      if (!ensureCanEdit(req, res, book.quem_user_id?.toString())) {
        return
      }

      const authorName =
        typeof book.autor === 'object' && book.autor && 'nome' in book.autor
          ? book.autor.nome
          : null
      if (!authorName) {
        res.status(400).json({ error: 'Livro sem autor válido para enriquecimento.' })
        return
      }

      const enrichment = await fetchEnrichmentPayload(book.titulo, authorName, book.isbn)
      if (!enrichment?.data) {
        res.status(404).json({ error: 'Nenhum dado de enriquecimento encontrado para este livro.' })
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
      handleDataError(res, err, 'Erro ao gerar preview de enriquecimento.')
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
          error: `fields deve ser lista não-vazia com valores permitidos: ${allowedFields.join(', ')}.`,
        })
        return
      }

      const book = await Book.findById(req.params.id).populate<{ autor: { nome: string } }>(
        'autor',
        'nome',
      )
      if (!book) {
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      if (!ensureCanEdit(req, res, book.quem_user_id?.toString())) {
        return
      }

      if (book.manually_edited_at) {
        res.status(409).json({
          error: 'Livro possui edição manual e não pode receber apply automático de enrichment.',
        })
        return
      }

      const authorName =
        typeof book.autor === 'object' && book.autor && 'nome' in book.autor
          ? book.autor.nome
          : null
      if (!authorName) {
        res.status(400).json({ error: 'Livro sem autor válido para enriquecimento.' })
        return
      }

      const enrichment = await fetchEnrichmentPayload(book.titulo, authorName, book.isbn)
      if (!enrichment?.data) {
        res.status(404).json({ error: 'Nenhum dado de enriquecimento encontrado para este livro.' })
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
        if (applyMap[field] !== undefined) {
          payload[field] = applyMap[field]
        }
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
      handleDataError(res, err, 'Erro ao aplicar enriquecimento.')
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
        res.status(404).json({ error: 'Livro não encontrado.' })
        return
      }

      console.log(`[DELETE /books/:id] "${book.titulo}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /books/:id]', err)
      handleDataError(res, err, 'Erro ao remover livro.')
    }
  },
)

export default router
