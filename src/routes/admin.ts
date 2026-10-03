import { Router } from 'express'
import type { Response } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { adminOnly } from '@/middleware/authorize.js'
import { authRateLimit } from '@/middleware/rateLimit.js'
import { ClaimHistory } from '@/models/ClaimHistory.js'
import { User } from '@/models/User.js'
import type { AuthRequest } from '@/types/index.ts'
import { handleDataError } from '@/utils/httpErrors.js'

const router = Router()

// The claims history is the Administrador's alone.
router.use(authenticate)

// ── GET /admin/users/claims/history ──────────────────────────────
router.get(
  '/users/claims/history',
  authRateLimit,
  adminOnly,
  async (req: AuthRequest, res: Response) => {
    try {
      const parsedLimit = Number(req.query.limit ?? 20)
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 20

      // total is every record, not this page: the panel says when the list it got is only the most recent part.
      const [history, total] = await Promise.all([
        ClaimHistory.find()
          .sort({ performed_at: -1 })
          .limit(limit)
          .select(
            'action user_id user_email claim_name previous_claim_names affected_books performed_at',
          )
          .lean(),
        ClaimHistory.countDocuments(),
      ])

      // The person's current name, as on Membros; the e-mail stays for whoever has since left the club.
      const ids = [...new Set(history.map((entry) => String(entry.user_id)))]
      const users = await User.find({ _id: { $in: ids } })
        .select('name')
        .lean()
      const nameOf = new Map(users.map((user) => [String(user._id), user.name]))
      res.json({
        total,
        history: history.map((entry) => ({
          ...entry,
          user_name: nameOf.get(String(entry.user_id)) ?? null,
        })),
      })
    } catch (err) {
      console.error('[GET /admin/users/claims/history]', err)
      handleDataError(res, err, 'Não foi possível carregar o histórico de vínculos. Tente de novo.')
    }
  },
)

export default router
