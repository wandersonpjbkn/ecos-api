import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize } from '@/middleware/authorize.js'
import { validateCreateNamed, validateObjectId } from '@/middleware/validate.js'
import { Autor } from '@/models/Autor.js'
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

// ── GET /autores ──────────────────────────────────────────────────
router.get('/', authorize('autores', 'read'), async (_req, res: Response) => {
  try {
    const autores = await Autor.find().sort({ nome: 1 }).lean()
    res.json(autores)
  } catch (err) {
    console.error('[GET /autores]', err)
    res.status(500).json({ error: 'Erro ao buscar autores.' })
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
        res.status(409).json({ error: `Autor "${exists.nome}" já existe.` })
        return
      }

      const autor = await Autor.create({ nome, slug, created_by: req.user!._id })

      console.log(`[POST /autores] "${autor.nome}" criado por ${req.user!.email}`)
      res.status(201).json(autor)
    } catch (err) {
      console.error('[POST /autores]', err)
      res.status(500).json({ error: 'Erro ao criar autor.' })
    }
  },
)

// ── DELETE /autores/:id ───────────────────────────────────────────
// Só deleta se nenhum livro usa o autor
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
          error: 'Autor em uso por um ou mais livros. Reatribua os livros antes de excluir.',
        })
        return
      }

      const autor = await Autor.findByIdAndDelete(req.params.id)
      if (!autor) {
        res.status(404).json({ error: 'Autor não encontrado.' })
        return
      }

      console.log(`[DELETE /autores/:id] "${autor.nome}" removido por ${req.user!.email}`)
      res.status(204).send()
    } catch (err) {
      console.error('[DELETE /autores/:id]', err)
      res.status(500).json({ error: 'Erro ao remover autor.' })
    }
  },
)

export default router
