import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateNamed, validateObjectId } from '@/middleware/validate.js'
import { Autor } from '@/models/Autor.js'
import type { AuthRequest } from '@/types/index.ts'
import { slugify } from '@/utils/global.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate)

// ── GET /autores ──────────────────────────────────────────────────
router.get('/', authorize('autores', 'read'), async (_req, res: Response) => {
  try {
    const autores = await Autor.find().sort({ nome: 1 }).lean()
    res.json(autores)
  } catch (err) {
    console.error('[GET /autores]', err)
    handleDataError(res, err, 'Não foi possível carregar os autores. Tente de novo.')
  }
})

// ── POST /autores ─────────────────────────────────────────────────
router.post(
  '/',
  authorize('autores', 'create'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const exists = await Autor.findOne({ slug })
      if (exists) {
        res.status(409).json({ error: `O autor "${exists.nome}" já existe.` })
        return
      }

      const autor = await Autor.create({ nome, slug, created_by: req.user!._id })

      console.log(`[POST /autores] "${autor.nome}" criado por ${req.user!.email}`)
      res.status(201).json(autor)
    } catch (err) {
      console.error('[POST /autores]', err)
      handleDataError(res, err, 'Não foi possível criar o autor. Tente de novo.')
    }
  },
)

// ── PATCH /autores/:id ────────────────────────────────────────────
router.patch(
  '/:id',
  validateObjectId('id'),
  authorize('autores', 'update'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const conflict = await Autor.findOne({ slug, _id: { $ne: req.params.id } })
      if (conflict) {
        res.status(409).json({ error: `O autor "${conflict.nome}" já existe.` })
        return
      }

      const autor = await Autor.findByIdAndUpdate(req.params.id, { nome, slug }, { new: true })
      if (!autor) {
        res.status(404).json({ error: 'Não achamos esse autor.' })
        return
      }

      console.log(`[PATCH /autores/:id] "${autor.nome}" atualizado por ${req.user!.email}`)
      res.json(autor)
    } catch (err) {
      console.error('[PATCH /autores/:id]', err)
      handleDataError(res, err, 'Não foi possível salvar o autor. Tente de novo.')
    }
  },
)

// ── DELETE /autores/:id ───────────────────────────────────────────
router.delete(
  '/:id',
  validateObjectId('id'),
  authorize('autores', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { Book } = await import('@/models/Book.js')
      const inUse = await Book.exists({ autor: req.params.id })
      if (inUse) {
        res.status(409).json({
          error: 'Há livros com esse autor. Troque o autor deles antes de remover.',
        })
        return
      }

      const autor = await Autor.findByIdAndDelete(req.params.id)
      if (!autor) {
        res.status(404).json({ error: 'Não achamos esse autor.' })
        return
      }

      console.log(`[DELETE /autores/:id] "${autor.nome}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /autores/:id]', err)
      handleDataError(res, err, 'Não foi possível remover o autor. Tente de novo.')
    }
  },
)

export default router
