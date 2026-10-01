import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateNamed, validateObjectId } from '@/middleware/validate.js'
import { Book } from '@/models/Book.js'
import { Subgenero } from '@/models/Subgenero.js'
import type { AuthRequest } from '@/types/index.ts'
import { slugify } from '@/utils/global.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate)

// ── GET /subgeneros ───────────────────────────────────────────────
router.get('/', authorize('subgeneros', 'read'), async (_req, res: Response) => {
  try {
    const subgenres = await Subgenero.find().sort({ nome: 1 }).lean()
    res.json(subgenres)
  } catch (err) {
    console.error('[GET /subgeneros]', err)
    handleDataError(res, err, 'Não foi possível carregar os subgêneros. Tente de novo.')
  }
})

// ── POST /subgeneros ──────────────────────────────────────────────
router.post(
  '/',
  authorize('subgeneros', 'create'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const name = req.body.nome.trim()
      const slug = slugify(name)

      const exists = await Subgenero.findOne({ slug })
      if (exists) {
        res.status(409).json({ error: `O subgênero "${exists.nome}" já existe.` })
        return
      }

      const subgenre = await Subgenero.create({
        nome: name,
        slug,
        created_by: req.user!._id,
      })

      console.log(`[POST /subgeneros] "${name}" criado por ${req.user!.email}`)
      res.status(201).json(subgenre)
    } catch (err) {
      console.error('[POST /subgeneros]', err)
      handleDataError(res, err, 'Não foi possível criar o subgênero. Tente de novo.')
    }
  },
)

// ── PATCH /subgeneros/:id ─────────────────────────────────────────
router.patch(
  '/:id',
  validateObjectId('id'),
  authorize('subgeneros', 'update'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const name = req.body.nome.trim()
      const slug = slugify(name)

      const conflict = await Subgenero.findOne({ slug, _id: { $ne: req.params.id } })
      if (conflict) {
        res.status(409).json({ error: `O subgênero "${conflict.nome}" já existe.` })
        return
      }

      const subgenre = await Subgenero.findByIdAndUpdate(
        req.params.id,
        { nome: name, slug },
        { new: true },
      )
      if (!subgenre) {
        res.status(404).json({ error: 'Não achamos esse subgênero.' })
        return
      }

      console.log(`[PATCH /subgeneros/:id] "${subgenre.nome}" atualizado por ${req.user!.email}`)
      res.json(subgenre)
    } catch (err) {
      console.error('[PATCH /subgeneros/:id]', err)
      handleDataError(res, err, 'Não foi possível salvar o subgênero. Tente de novo.')
    }
  },
)

// ── DELETE /subgeneros/:id ────────────────────────────────────────
// ── GET /subgeneros/:id/usage ─────────────────────────────────────
router.get(
  '/:id/usage',
  validateObjectId('id'),
  authorize('subgeneros', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      // What the removal dialog tells the admin: counted here, not on a copy of the catalog kept in a browser.
      res.json({ books: await Book.countDocuments({ subgeneros: req.params.id }) })
    } catch (err) {
      console.error('[GET /subgeneros/:id/usage]', err)
      handleDataError(res, err, 'Não foi possível contar os livros. Tente de novo.')
    }
  },
)

router.delete(
  '/:id',
  validateObjectId('id'),
  authorize('subgeneros', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const subgenre = await Subgenero.findByIdAndDelete(req.params.id)
      if (!subgenre) {
        res.status(404).json({ error: 'Não achamos esse subgênero.' })
        return
      }

      console.log(`[DELETE /subgeneros/:id] "${subgenre.nome}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /subgeneros/:id]', err)
      handleDataError(res, err, 'Não foi possível remover o subgênero. Tente de novo.')
    }
  },
)

export default router
