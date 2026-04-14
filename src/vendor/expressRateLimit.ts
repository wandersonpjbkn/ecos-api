import type { NextFunction, Request, RequestHandler, Response } from 'express'

interface RateLimitOptions {
  windowMs: number
  max: number
  message?: { error: string } | string
  standardHeaders?: boolean | 'draft-7'
  legacyHeaders?: boolean
}

interface HitRecord {
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

const sendLimitResponse = (res: Response, message: RateLimitOptions['message']): void => {
  if (typeof message === 'string') {
    res.status(429).json({ error: message })
    return
  }

  if (message && typeof message === 'object' && 'error' in message) {
    res.status(429).json(message)
    return
  }

  res.status(429).json({ error: 'Too many requests' })
}

const rateLimit = ({ windowMs, max, message, standardHeaders, legacyHeaders }: RateLimitOptions): RequestHandler => {
  const hits = new Map<string, HitRecord>()

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.method}:${req.path}:${getClientKey(req)}`
    const now = Date.now()
    const current = hits.get(key)

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (current.count >= max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)))

      if (standardHeaders === true || standardHeaders === 'draft-7') {
        res.setHeader('RateLimit-Limit', String(max))
        res.setHeader('RateLimit-Remaining', '0')
        res.setHeader('RateLimit-Reset', String(Math.max(retryAfter, 1)))
      }

      if (legacyHeaders === true) {
        res.setHeader('X-RateLimit-Limit', String(max))
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', String(Math.floor(current.resetAt / 1000)))
      }

      sendLimitResponse(res, message)
      return
    }

    current.count += 1
    hits.set(key, current)
    next()
  }
}

export default rateLimit
