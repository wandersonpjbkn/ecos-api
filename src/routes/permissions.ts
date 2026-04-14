import { Router } from 'express'
import type { Response } from 'express'

import { ACTIONS, RESOURCES } from '@/constants/index.js'
import { authenticate } from '@/middleware/authenticate.js'
import { adminOnly } from '@/middleware/authorize.js'
import { authRateLimit, writeRateLimit } from '@/middleware/rateLimit.js'
import { Permission } from '@/models/Permission.js'
import type { AuthRequest, Action, Role, Resource } from '@/types/index.ts'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate, adminOnly)

// ── GET /permissions ──────────────────────────────────────────────
// Retorna a matriz completa de permissões por role
router.get('/', async (_req, res: Response) => {
  try {
    const permissions = await Permission.find().sort({ role: 1, resource: 1 }).lean()
    res.json(permissions)
  } catch (err) {
    console.error('[GET /permissions]', err)
    handleDataError(res, err, 'Erro ao buscar permissões.')
  }
})

// ── PUT /permissions/:role/:resource ──────────────────────────────
// Substitui as actions de uma combinação role+resource
router.put('/:role/:resource', authRateLimit, writeRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    const { role, resource } = req.params
    const { actions } = req.body as { actions?: unknown }

    // Validações
    if (!['admin', 'editor', 'viewer'].includes(role as string)) {
      res.status(400).json({ error: 'role inválido.' })
      return
    }

    if (!RESOURCES.includes(resource as never)) {
      res.status(400).json({ error: 'resource inválido.' })
      return
    }

    if (!Array.isArray(actions) || actions.some((a) => !ACTIONS.includes(a as Action))) {
      res.status(400).json({ error: `actions devem ser: ${ACTIONS.join(', ')}.` })
      return
    }

    const safeRole = role as Role
    const safeResource = resource as Resource
    const safeActions = [...new Set(actions.map((action) => String(action).trim() as Action))]

    // Admin não pode remover a própria permissão de leitura de permissions
    if (safeRole === 'admin' && safeResource === 'permissions' && !safeActions.includes('read')) {
      res.status(400).json({ error: 'Admin deve manter leitura de permissions.' })
      return
    }

    const permission = await Permission.findOneAndUpdate(
      { role: safeRole, resource: safeResource },
      { actions: safeActions },
      { new: true, upsert: true },
    )

    console.log(
      `[PUT /permissions] ${safeRole}/${safeResource} → [${safeActions.join(', ')}] por ${req.user!.email}`,
    )
    res.json(permission)
  } catch (err) {
    console.error('[PUT /permissions/:role/:resource]', err)
    handleDataError(res, err, 'Erro ao atualizar permissão.')
  }
})

export default router
