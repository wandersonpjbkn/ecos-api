import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { adminOnly } from '@/middleware/authorize.js'
import { Book } from '@/models/Book.js'
import type { AuthRequest } from '@/types/index.ts'
import { fetchGoogleBooks } from '@/utils/googleBooks.js'

const router = Router()

router.use(authenticate, adminOnly)

// ── POST /admin/books/enrich ──────────────────────────────────────
/**
 * Enriquece livros com dados da Google Books API.
 *
 * Comportamento padrão: processa apenas livros sem cover_url.
 * Com { force: true } no body: re-enriquece todos os livros.
 *
 * Busca na ordem: ISBN → título+autor (pt) → título+autor (sem lang).
 * Delay de 200ms entre requests para respeitar o rate limit da API.
 *
 * Retorna relatório completo com totais e status de cada livro.
 */
router.post('/books/enrich', async (req: AuthRequest, res: Response) => {
  if (req.body?.force !== undefined && typeof req.body.force !== 'boolean') {
    res.status(400).json({ error: 'O campo "force" deve ser booleano.' })
    return
  }

  const force = req.body?.force === true

  try {
    const filter = force
      ? {}
      : {
          $or: [{ cover_url: { $exists: false } }, { cover_url: null }, { cover_url: '' }],
        }
    const books = await Book.find(filter)
      .populate<{ autor: { nome: string } }>('autor', 'nome')
      .select('titulo autor isbn cover_url enriched_at')
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
      status: 'enriched' | 'not_found' | 'failed'
      strategy?: 'isbn' | 'title_author_pt' | 'title_author'
      cover_url?: string
    }> = []

    let enriched = 0
    let skipped = 0
    let failed = 0

    for (const book of books) {
      if (results.length > 0) {
        await new Promise((r) => setTimeout(r, 200))
      }

      try {
        const data = await fetchGoogleBooks(book.titulo, book.autor.nome, book.isbn)

        if (!data) {
          skipped++
          results.push({ id: String(book._id), titulo: book.titulo, status: 'not_found' })
          continue
        }

        await Book.updateOne({ _id: book._id }, { $set: { ...data, enriched_at: new Date() } })

        enriched++
        results.push({
          id: String(book._id),
          titulo: book.titulo,
          status: 'enriched',
          strategy: data.strategy,
          cover_url: data.cover_url,
        })
      } catch (err) {
        failed++
        results.push({ id: String(book._id), titulo: book.titulo, status: 'failed' })
        console.error(`[enrich] ❌ "${book.titulo}":`, err)
      }
    }

    console.log(
      `[POST /admin/books/enrich] Concluído: ${enriched} enriquecidos,` +
        ` ${skipped} não encontrados, ${failed} com erro`,
    )

    res.json({
      message: 'Enriquecimento concluído.',
      total: books.length,
      enriched,
      skipped,
      failed,
      results,
    })
  } catch (err) {
    console.error('[POST /admin/books/enrich]', err)
    res.status(500).json({ error: 'Erro ao executar enriquecimento.' })
  }
})

// ── GET /admin/books/enrich/status ────────────────────────────────
/**
 * Resumo do estado atual do enriquecimento:
 * total de livros, quantos têm capa, cobertura percentual,
 * e data do último enriquecimento executado.
 */
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
    res.status(500).json({ error: 'Erro ao buscar status.' })
  }
})

export default router
