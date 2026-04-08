import { Router } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import type { AuthRequest } from '@/types/index.ts'

const router = Router()

/**
 * POST /auth/verify
 * Valida o JWT do Supabase, cria o usuário no MongoDB se for o primeiro acesso,
 * e retorna os dados do usuário autenticado.
 *
 * O frontend chama este endpoint logo após o login no Supabase.
 */
router.post('/verify', authenticate, (req: AuthRequest, res) => {
  res.json({ user: req.user })
})

export default router
