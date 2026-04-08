import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authorize, adminOnly } from '@/middleware/authorize.js'
import { validateUpdateRole, validateObjectId } from '@/middleware/validate.js'
import { User } from '@/models/User.js'
import type { AuthRequest } from '@/types/index.ts'

const router = Router()

router.use(authenticate)

// ── GET /users ────────────────────────────────────────────────────
// Lista todos os membros — admin e editor podem ver
router.get('/', authorize('users', 'read'), async (_req, res: Response) => {
  try {
    const users = await User.find()
      .select('-supabase_uid')
      .sort({ created_at: -1 })
      .lean()

    res.json(users)
  } catch (err) {
    console.error('[GET /users]', err)
    res.status(500).json({ error: 'Erro ao buscar usuários.' })
  }
})

// ── GET /users/me ─────────────────────────────────────────────────
// Retorna o próprio usuário autenticado
router.get('/me', (req: AuthRequest, res: Response) => {
  res.json({ user: req.user })
})

// ── PATCH /users/:id/role ─────────────────────────────────────────
// Somente admin pode alterar roles
router.patch(
  '/:id/role',
  validateObjectId('id'),
  adminOnly,
  validateUpdateRole,
  async (req: AuthRequest, res: Response) => {
    try {
      // Admin não pode rebaixar a si mesmo
      if (req.params.id === req.user!._id.toString()) {
        res.status(400).json({ error: 'Você não pode alterar sua própria role.' })
        return
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: req.body.role },
        { new: true, select: '-supabase_uid' },
      )

      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado.' })
        return
      }

      console.log(`[PATCH /users/:id/role] ${user.email} → ${user.role} por ${req.user!.email}`)
      res.json(user)
    } catch (err) {
      console.error('[PATCH /users/:id/role]', err)
      res.status(500).json({ error: 'Erro ao atualizar role.' })
    }
  },
)

// ── PATCH /users/me ───────────────────────────────────────────────
// Qualquer usuário pode editar o próprio nome
router.patch('/me', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name é obrigatório.' })
      return
    }

    if (name.trim().length > 60) {
      res.status(400).json({ error: 'name deve ter no máximo 60 caracteres.' })
      return
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name: name.trim() },
      { new: true, select: '-supabase_uid' },
    )

    res.json(user)
  } catch (err) {
    console.error('[PATCH /users/me]', err)
    res.status(500).json({ error: 'Erro ao atualizar perfil.' })
  }
})

export default router
