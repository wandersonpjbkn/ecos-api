import { Router } from 'express'
import type { Response } from 'express'

import { keepAliveRateLimit } from '@/middleware/rateLimit.js'
import { checkSupabaseAuth } from '@/utils/healthCheckers.js'

const router = Router()

router.get('/', (_req, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

router.get('/keep-alive', keepAliveRateLimit, async (_req, res: Response) => {
  try {
    await checkSupabaseAuth()
    res.status(204).end()
  } catch (err) {
    console.error('[GET /health/keep-alive]', err)
    res.status(503).json({ error: 'Provedor de autenticação indisponível.' })
  }
})

export default router
