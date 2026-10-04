import { Router } from 'express'
import type { Response } from 'express'

import { ACTIONS, CONFIGURABLE, RESOURCES } from '@/constants/index.js'
import { authenticate } from '@/middleware/authenticate.js'
import { adminOnly } from '@/middleware/authorize.js'
import { authRateLimit, writeRateLimit } from '@/middleware/rateLimit.js'
import { Permission } from '@/models/Permission.js'
import type { AuthRequest, Action, Role, Resource } from '@/types/index.ts'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

router.use(authenticate, adminOnly)

// ── GET /permissions ──────────────────────────────────────────────
router.get('/', async (_req, res: Response) => {
  try {
    const permissions = await Permission.find().sort({ role: 1, resource: 1 }).lean()
    res.json({ permissions, configurable: CONFIGURABLE })
  } catch (err) {
    console.error('[GET /permissions]', err)
    handleDataError(res, err, 'Não foi possível carregar as permissões. Tente de novo.')
  }
})

// ── PUT /permissions/:role/:resource ──────────────────────────────
router.put(
  '/:role/:resource',
  authRateLimit,
  writeRateLimit,
  async (req: AuthRequest, res: Response) => {
    try {
      const { role, resource } = req.params
      const { actions } = req.body as { actions?: unknown }

      if (!['admin', 'editor', 'viewer'].includes(role as string)) {
        res.status(400).json({ error: 'Não foi possível salvar a permissão. Tente de novo.' })
        return
      }

      if (!RESOURCES.includes(resource as never)) {
        res.status(400).json({ error: 'Não foi possível salvar a permissão. Tente de novo.' })
        return
      }

      if (!Array.isArray(actions) || actions.some((a) => !ACTIONS.includes(a as Action))) {
        res.status(400).json({ error: 'Não foi possível salvar a permissão. Tente de novo.' })
        return
      }

      const safeRole = role as Role
      const safeResource = resource as Resource
      const allowed = CONFIGURABLE[safeResource]
      const safeActions = [...new Set(actions.map((action) => String(action).trim() as Action))]

      if (safeActions.some((action) => !allowed.includes(action))) {
        res.status(400).json({ error: 'Essa permissão não muda nada no clube.' })
        return
      }
      if (
        allowed.includes('read') &&
        safeActions.some((action) => action !== 'read') &&
        !safeActions.includes('read')
      ) {
        safeActions.push('read')
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
      handleDataError(res, err, 'Não foi possível salvar a permissão. Tente de novo.')
    }
  },
)

export default router
