import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateNamed, validateObjectId } from '@/middleware/validate.js'
import { Midia } from '@/models/Midia.js'
import type { AuthRequest } from '@/types/index.ts'
import { slugify } from '@/utils/global.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate)

// ── GET /midias ───────────────────────────────────────────────────
router.get('/', authorize('midias', 'read'), async (_req, res: Response) => {
  try {
    const midias = await Midia.find().sort({ nome: 1 }).lean()
    res.json(midias)
  } catch (err) {
    console.error('[GET /midias]', err)
    handleDataError(res, err, 'Erro ao buscar mídias.')
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
      handleDataError(res, err, 'Erro ao criar mídia.')
    }
  },
)

// ── PATCH /midias/:id ─────────────────────────────────────────────
router.patch(
  '/:id',
  validateObjectId('id'),
  authorize('midias', 'update'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const conflict = await Midia.findOne({ slug, _id: { $ne: req.params.id } })
      if (conflict) {
        res.status(409).json({ error: `Mídia "${conflict.nome}" já existe.` })
        return
      }

      const midia = await Midia.findByIdAndUpdate(req.params.id, { nome, slug }, { new: true })
      if (!midia) {
        res.status(404).json({ error: 'Mídia não encontrada.' })
        return
      }

      console.log(`[PATCH /midias/:id] "${midia.nome}" atualizada por ${req.user!.email}`)
      res.json(midia)
    } catch (err) {
      console.error('[PATCH /midias/:id]', err)
      handleDataError(res, err, 'Erro ao atualizar mídia.')
    }
  },
)

// ── DELETE /midias/:id ────────────────────────────────────────────
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
      handleDataError(res, err, 'Erro ao remover mídia.')
    }
  },
)

export default router
