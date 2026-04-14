import { Router } from 'express'
import type { Response } from 'express'

import { ACTIONS, RESOURCES } from '@/constants/index.js'
import { authenticate } from '@/middleware/authenticate.js'
import { adminOnly } from '@/middleware/authorize.js'
import { Permission } from '@/models/Permission.js'
import type { AuthRequest, Action } from '@/types/index.ts'
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
router.put('/:role/:resource', async (req: AuthRequest, res: Response) => {
  try {
    const { role, resource } = req.params
    const { actions } = req.body

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

    // Admin não pode remover a própria permissão de leitura de permissions
    if (role === 'admin' && resource === 'permissions' && !actions.includes('read')) {
      res.status(400).json({ error: 'Admin deve manter leitura de permissions.' })
      return
    }

    const permission = await Permission.findOneAndUpdate(
      { role, resource },
      { actions },
      { new: true, upsert: true },
    )

    console.log(
      `[PUT /permissions] ${role}/${resource} → [${actions.join(', ')}] por ${req.user!.email}`,
    )
    res.json(permission)
  } catch (err) {
    console.error('[PUT /permissions/:role/:resource]', err)
    handleDataError(res, err, 'Erro ao atualizar permissão.')
  }
})

export default router
