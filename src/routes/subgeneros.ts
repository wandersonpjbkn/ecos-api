import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateSubgenero, validateObjectId } from '@/middleware/validate.js'
import { Subgenero } from '@/models/Subgenero.js'
import type { AuthRequest } from '@/types/index.ts'
import { slugify } from '@/utils/global.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate)

// ── GET /subgeneros ───────────────────────────────────────────────
router.get('/', authorize('subgeneros', 'read'), async (_req, res: Response) => {
  try {
    const subgeneros = await Subgenero.find().sort({ nome: 1 }).lean()
    res.json(subgeneros)
  } catch (err) {
    console.error('[GET /subgeneros]', err)
    handleDataError(res, err, 'Erro ao buscar sub-gêneros.')
  }
})

// ── POST /subgeneros ──────────────────────────────────────────────
router.post(
  '/',
  authorize('subgeneros', 'create'),
  validateCreateSubgenero,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const exists = await Subgenero.findOne({ slug })
      if (exists) {
        res.status(409).json({ error: `Sub-gênero "${exists.nome}" já existe.` })
        return
      }

      const subgenero = await Subgenero.create({
        nome,
        slug,
        created_by: req.user!._id,
      })

      console.log(`[POST /subgeneros] "${nome}" criado por ${req.user!.email}`)
      res.status(201).json(subgenero)
    } catch (err) {
      console.error('[POST /subgeneros]', err)
      handleDataError(res, err, 'Erro ao criar sub-gênero.')
    }
  },
)

// ── PATCH /subgeneros/:id ─────────────────────────────────────────
router.patch(
  '/:id',
  validateObjectId('id'),
  authorize('subgeneros', 'update'),
  validateCreateSubgenero,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const conflict = await Subgenero.findOne({ slug, _id: { $ne: req.params.id } })
      if (conflict) {
        res.status(409).json({ error: `Sub-gênero "${conflict.nome}" já existe.` })
        return
      }

      const subgenero = await Subgenero.findByIdAndUpdate(
        req.params.id,
        { nome, slug },
        { new: true },
      )
      if (!subgenero) {
        res.status(404).json({ error: 'Sub-gênero não encontrado.' })
        return
      }

      console.log(`[PATCH /subgeneros/:id] "${subgenero.nome}" atualizado por ${req.user!.email}`)
      res.json(subgenero)
    } catch (err) {
      console.error('[PATCH /subgeneros/:id]', err)
      handleDataError(res, err, 'Erro ao atualizar sub-gênero.')
    }
  },
)

// ── DELETE /subgeneros/:id ────────────────────────────────────────
router.delete(
  '/:id',
  validateObjectId('id'),
  authorize('subgeneros', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const subgenero = await Subgenero.findByIdAndDelete(req.params.id)
      if (!subgenero) {
        res.status(404).json({ error: 'Sub-gênero não encontrado.' })
        return
      }

      console.log(`[DELETE /subgeneros/:id] "${subgenero.nome}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /subgeneros/:id]', err)
      handleDataError(res, err, 'Erro ao remover sub-gênero.')
    }
  },
)

export default router
