import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateNamed, validateObjectId } from '@/middleware/validate.js'
import { Midia } from '@/models/Midia.js'
import type { AuthRequest } from '@/types/index.ts'

const router = Router()

router.use(authenticate)

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')

// ── GET /midias ───────────────────────────────────────────────────
router.get('/', authorize('midias', 'read'), async (_req, res: Response) => {
  try {
    const midias = await Midia.find().sort({ nome: 1 }).lean()
    res.json(midias)
  } catch (err) {
    console.error('[GET /midias]', err)
    res.status(500).json({ error: 'Erro ao buscar mídias.' })
  }
})

// ── POST /midias ──────────────────────────────────────────────────
router.post(
  '/',
  authorize('midias', 'create'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const exists = await Midia.findOne({ slug })
      if (exists) {
        res.status(409).json({ error: `Mídia "${exists.nome}" já existe.` })
        return
      }

      const midia = await Midia.create({ nome, slug, created_by: req.user!._id })

      console.log(`[POST /midias] "${midia.nome}" criada por ${req.user!.email}`)
      res.status(201).json(midia)
    } catch (err) {
      console.error('[POST /midias]', err)
      res.status(500).json({ error: 'Erro ao criar mídia.' })
    }
  },
)

// ── DELETE /midias/:id ────────────────────────────────────────────
// Só deleta se nenhum livro usa a mídia
router.delete(
  '/:id',
  validateObjectId('id'),
  authorize('midias', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { Book } = await import('@/models/Book.js')
      const inUse = await Book.exists({ midia: req.params.id })
      if (inUse) {
        res.status(409).json({
          error: 'Mídia em uso por um ou mais livros. Reatribua os livros antes de excluir.',
        })
        return
      }

      const midia = await Midia.findByIdAndDelete(req.params.id)
      if (!midia) {
        res.status(404).json({ error: 'Mídia não encontrada.' })
        return
      }

      console.log(`[DELETE /midias/:id] "${midia.nome}" removida por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /midias/:id]', err)
      res.status(500).json({ error: 'Erro ao remover mídia.' })
    }
  },
)

export default router
