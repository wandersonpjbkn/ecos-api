import { Router } from 'express'

import { authenticate } from '@/middleware/authenticate.js'
import { authRateLimit } from '@/middleware/rateLimit.js'
import type { AuthRequest } from '@/types/index.ts'

const router = Router()

router.post('/verify', authRateLimit, authenticate, (req: AuthRequest, res) => {
  res.json({ user: req.user })
})

export default router
