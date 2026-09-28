import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateNamed, validateObjectId } from '@/middleware/validate.js'
import { Categoria } from '@/models/Categoria.js'
import type { AuthRequest } from '@/types/index.ts'
import { slugify } from '@/utils/global.js'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()
router.use(authenticate)

// ── GET /categorias ───────────────────────────────────────────────
router.get('/', authorize('categorias', 'read'), async (_req, res: Response) => {
  try {
    res.json(await Categoria.find().sort({ nome: 1 }).lean())
  } catch (err) {
    console.error('[GET /categorias]', err)
    handleDataError(res, err, 'Não foi possível carregar os gêneros. Tente de novo.')
  }
})

// ── POST /categorias ──────────────────────────────────────────────
router.post(
  '/',
  authorize('categorias', 'create'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)
      const exists = await Categoria.findOne({ slug })
      if (exists) {
        res.status(409).json({ error: `O gênero "${exists.nome}" já existe.` })
        return
      }
      const categoria = await Categoria.create({ nome, slug, created_by: req.user!._id })
      console.log(`[POST /categorias] "${categoria.nome}" criada por ${req.user!.email}`)
      res.status(201).json(categoria)
    } catch (err) {
      console.error('[POST /categorias]', err)
      handleDataError(res, err, 'Não foi possível criar o gênero. Tente de novo.')
    }
  },
)

// ── PATCH /categorias/:id ─────────────────────────────────────────
router.patch(
  '/:id',
  validateObjectId('id'),
  authorize('categorias', 'update'),
  validateCreateNamed,
  async (req: AuthRequest, res: Response) => {
    try {
      const nome = req.body.nome.trim()
      const slug = slugify(nome)

      const conflict = await Categoria.findOne({ slug, _id: { $ne: req.params.id } })
      if (conflict) {
        res.status(409).json({ error: `O gênero "${conflict.nome}" já existe.` })
        return
      }

      const categoria = await Categoria.findByIdAndUpdate(
        req.params.id,
        { nome, slug },
        { new: true },
      )
      if (!categoria) {
        res.status(404).json({ error: 'Não achamos esse gênero.' })
        return
      }

      console.log(`[PATCH /categorias/:id] "${categoria.nome}" atualizada por ${req.user!.email}`)
      res.json(categoria)
    } catch (err) {
      console.error('[PATCH /categorias/:id]', err)
      handleDataError(res, err, 'Não foi possível salvar o gênero. Tente de novo.')
    }
  },
)

// ── DELETE /categorias/:id ────────────────────────────────────────
router.delete(
  '/:id',
  validateObjectId('id'),
  authorize('categorias', 'delete'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { Book } = await import('@/models/Book.js')
      if (await Book.exists({ categoria: req.params.id })) {
        res
          .status(409)
          .json({ error: 'Há livros com esse gênero. Troque o gênero deles antes de remover.' })
        return
      }
      const categoria = await Categoria.findByIdAndDelete(req.params.id)
      if (!categoria) {
        res.status(404).json({ error: 'Não achamos esse gênero.' })
        return
      }
      console.log(`[DELETE /categorias/:id] "${categoria.nome}" removida por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /categorias/:id]', err)
      handleDataError(res, err, 'Não foi possível remover o gênero. Tente de novo.')
    }
  },
)

export default router
