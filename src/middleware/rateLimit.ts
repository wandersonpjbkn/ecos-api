import type { NextFunction, Request, Response } from 'express'

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: string
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

const getClientKey = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? req.ip ?? 'unknown'
  }

  return req.ip ?? 'unknown'
}

export const createRateLimit = ({ windowMs, max, message }: RateLimitOptions) => {
  const hits = new Map<string, RateLimitEntry>()

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.method}:${req.path}:${getClientKey(req)}`
    const now = Date.now()
    const existing = hits.get(key)

    if (!existing || existing.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (existing.count >= max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)))
      res.status(429).json({ error: message ?? 'Muitas requisições. Tente novamente em instantes.' })
      return
    }

    existing.count += 1
    hits.set(key, existing)
    next()
  }
}

export const authRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 60,
})

export const enrichmentRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 20,
  message: 'Muitas tentativas de enriquecimento. Aguarde alguns segundos e tente novamente.',
})
