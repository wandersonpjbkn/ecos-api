import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { adminOnly } from '@/middleware/authorize.js'
import { Book } from '@/models/Book.js'
import { ClaimHistory } from '@/models/ClaimHistory.js'
import { EnrichmentRun } from '@/models/EnrichmentRun.js'
import type { AuthRequest } from '@/types/index.ts'
import { fetchEnrichmentPayload, getCoverSourceFromEnrichment } from '@/utils/enrichment.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate, adminOnly)

// ── POST /admin/books/enrich ──────────────────────────────────────
router.post('/books/enrich', async (req: AuthRequest, res: Response) => {
  if (req.body?.force !== undefined && typeof req.body.force !== 'boolean') {
    res.status(400).json({ error: 'O campo "force" deve ser booleano.' })
    return
  }

  const force = req.body?.force === true
  const startedAt = new Date()

  try {
    const filter = force
      ? {}
      : { $or: [{ cover_url: { $exists: false } }, { cover_url: null }, { cover_url: '' }] }

    const books = await Book.find(filter)
      .populate<{ autor: { nome: string } }>('autor', 'nome')
      .select('titulo autor isbn cover_url enriched_at manually_edited_at')
      .lean()

    if (!books.length) {
      res.json({
        message: 'Nenhum livro para enriquecer.',
        total: 0,
        enriched: 0,
        skipped: 0,
        failed: 0,
        results: [],
      })
      return
    }

    console.log(
      `[POST /admin/books/enrich] Iniciando enriquecimento de ${books.length} livros` +
        ` (force=${force}) por ${req.user!.email}`,
    )

    const results: Array<{
      id: string
      titulo: string
      status: 'applied' | 'skipped' | 'failed'
      source?: 'google_books' | 'open_library'
      reason?: 'manual_edit' | 'not_found' | 'missing_author'
      strategy?:
        | 'isbn'
        | 'title_author_pt'
        | 'title_author'
        | 'openlibrary_isbn'
        | 'openlibrary_title_author'
      cover_url?: string
      error?: string
    }> = []

    let enriched = 0
    let skipped = 0
    let failed = 0

    for (const book of books) {
      if (book.manually_edited_at) {
        skipped++
        results.push({
          id: String(book._id),
          titulo: book.titulo,
          status: 'skipped',
          reason: 'manual_edit',
        })
        continue
      }

      if (results.length > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }

      try {
        // Guarda de tipo: autor pode não ter sido populado em documentos com migração incompleta
        const autorPopulated =
          book.autor !== null && typeof book.autor === 'object' && 'nome' in (book.autor as object)

        if (!autorPopulated) {
          console.warn(`[enrich] ⚠️  "${book.titulo}" sem autor populado — pulando`)
          skipped++
          results.push({ id: String(book._id), titulo: book.titulo, status: 'skipped', reason: 'missing_author' })
          continue
        }

        const autorNome = (book.autor as unknown as { nome: string }).nome

        const enrichment = await fetchEnrichmentPayload(book.titulo, autorNome, book.isbn)

        if (!enrichment?.data) {
          skipped++
          results.push({ id: String(book._id), titulo: book.titulo, status: 'skipped', reason: 'not_found' })
          continue
        }

        const updatePayload: Record<string, unknown> = {
          ...enrichment.data,
          enriched_at: new Date(),
        }
        if (enrichment.data.cover_url) {
          updatePayload.cover_source = getCoverSourceFromEnrichment(enrichment.source)
        }
        await Book.updateOne({ _id: book._id }, { $set: updatePayload })

        enriched++
        results.push({
          id: String(book._id),
          titulo: book.titulo,
          status: 'applied',
          source: enrichment.source,
          strategy: enrichment.data.strategy,
          cover_url: enrichment.data.cover_url,
        })
      } catch (err) {
        failed++
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
        results.push({
          id: String(book._id),
          titulo: book.titulo,
          status: 'failed',
          error: errorMessage,
        })
        console.error(`[enrich] ❌ "${book.titulo}":`, err)
      }
    }

    const withCoverAfter = await Book.countDocuments({ cover_url: { $exists: true, $ne: '' } })
    const totalAfter = await Book.countDocuments()
    const coverageAfter = totalAfter > 0 ? Math.round((withCoverAfter / totalAfter) * 100) : 0

    await EnrichmentRun.create({
      started_at: startedAt,
      finished_at: new Date(),
      force,
      initiated_by: req.user!._id,
      initiated_by_email: req.user!.email,
      total: books.length,
      enriched,
      skipped,
      failed,
      coverage_pct_after: coverageAfter,
      results: results.map((r) => ({
        book_id: r.id,
        titulo: r.titulo,
        status: r.status,
        source: r.source,
        reason: r.reason,
        strategy: r.strategy,
        cover_url: r.cover_url,
        error: r.error,
      })),
    })

    console.log(
      `[POST /admin/books/enrich] Concluído: ${enriched} aplicados,` +
        ` ${skipped} ignorados, ${failed} com erro`,
    )

    res.json({
      message: 'Enriquecimento concluído.',
      total: books.length,
      enriched,
      skipped,
      failed,
      coverage_pct_after: coverageAfter,
      results,
    })
  } catch (err) {
    console.error('[POST /admin/books/enrich]', err)
    handleDataError(res, err, 'Erro ao executar enriquecimento.')
  }
})

// ── GET /admin/books/enrich/status ────────────────────────────────
router.get('/books/enrich/status', async (_req: AuthRequest, res: Response) => {
  try {
    const [total, withCover, lastEnriched] = await Promise.all([
      Book.countDocuments(),
      Book.countDocuments({ cover_url: { $exists: true, $ne: '' } }),
      Book.findOne({ enriched_at: { $exists: true } })
        .sort({ enriched_at: -1 })
        .select('enriched_at')
        .lean(),
    ])

    res.json({
      total,
      with_cover: withCover,
      without_cover: total - withCover,
      coverage_pct: total > 0 ? Math.round((withCover / total) * 100) : 0,
      last_enriched_at: lastEnriched?.enriched_at ?? null,
    })
  } catch (err) {
    console.error('[GET /admin/books/enrich/status]', err)
    handleDataError(res, err, 'Erro ao buscar status.')
  }
})

// ── GET /admin/books/enrich/history ───────────────────────────────
router.get('/books/enrich/history', async (req: AuthRequest, res: Response) => {
  try {
    const parsedLimit = Number(req.query.limit ?? 10)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10

    const history = await EnrichmentRun.find()
      .sort({ finished_at: -1 })
      .limit(limit)
      .select(
        'started_at finished_at force initiated_by_email total enriched skipped failed coverage_pct_after results',
      )
      .lean()

    res.json({ total_runs: history.length, history })
  } catch (err) {
    console.error('[GET /admin/books/enrich/history]', err)
    handleDataError(res, err, 'Erro ao buscar histórico de enriquecimentos.')
  }
})

// ── GET /admin/users/claims/history ──────────────────────────────
router.get('/users/claims/history', async (req: AuthRequest, res: Response) => {
  try {
    const parsedLimit = Number(req.query.limit ?? 20)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20

    const history = await ClaimHistory.find()
      .sort({ performed_at: -1 })
      .limit(limit)
      .select(
        'action user_id user_email claim_name previous_claim_names affected_books performed_at',
      )
      .lean()

    res.json({ total: history.length, history })
  } catch (err) {
    console.error('[GET /admin/users/claims/history]', err)
    handleDataError(res, err, 'Erro ao buscar histórico de claims.')
  }
})

export default router
