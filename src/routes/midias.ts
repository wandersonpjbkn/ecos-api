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
    const formats = await Midia.find().sort({ nome: 1 }).lean()
    res.json(formats)
  } catch (err) {
    console.error('[GET /midias]', err)
    handleDataError(res, err, 'Não foi possível carregar os formatos. Tente de novo.')
  }
})

// ── POST /midias ──────────────────────────────────────────────────
router.post(
  '/',
  authorize('midias', 'create'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const name = req.body.nome.trim()
      const slug = slugify(name)

      const exists = await Midia.findOne({ slug })
      if (exists) {
        res.status(409).json({ error: `O formato "${exists.nome}" já existe.` })
        return
      }

      const format = await Midia.create({ nome: name, slug, created_by: req.user!._id })

      console.log(`[POST /midias] "${format.nome}" criada por ${req.user!.email}`)
      res.status(201).json(format)
    } catch (err) {
      console.error('[POST /midias]', err)
      handleDataError(res, err, 'Não foi possível criar o formato. Tente de novo.')
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
      const name = req.body.nome.trim()
      const slug = slugify(name)

      const conflict = await Midia.findOne({ slug, _id: { $ne: req.params.id } })
      if (conflict) {
        res.status(409).json({ error: `O formato "${conflict.nome}" já existe.` })
        return
      }

      const format = await Midia.findByIdAndUpdate(req.params.id, { nome: name, slug }, { new: true })
      if (!format) {
        res.status(404).json({ error: 'Não achamos esse formato.' })
        return
      }

      console.log(`[PATCH /midias/:id] "${format.nome}" atualizada por ${req.user!.email}`)
      res.json(format)
    } catch (err) {
      console.error('[PATCH /midias/:id]', err)
      handleDataError(res, err, 'Não foi possível salvar o formato. Tente de novo.')
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
          error: 'Há livros com esse formato. Troque o formato deles antes de remover.',
        })
        return
      }

      const format = await Midia.findByIdAndDelete(req.params.id)
      if (!format) {
        res.status(404).json({ error: 'Não achamos esse formato.' })
        return
      }

      console.log(`[DELETE /midias/:id] "${format.nome}" removida por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /midias/:id]', err)
      handleDataError(res, err, 'Não foi possível remover o formato. Tente de novo.')
    }
  },
)

export default router
