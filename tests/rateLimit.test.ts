import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { writeRateLimit } from '@/middleware/rateLimit.js'

const WRITE_LIMIT = 30

// Behind one proxy, the real client is the last X-Forwarded-For entry; anything before it is the caller's to write.
const buildApp = () => {
  const app = express()
  app.set('trust proxy', 1)
  app.get('/books/:id', writeRateLimit, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

const statusesFor = async (app: express.Express, requests: { path: string; forwardedFor: string }[]) => {
  const statuses: number[] = []
  for (const { path, forwardedFor } of requests) {
    const res = await request(app).get(path).set('X-Forwarded-For', forwardedFor)
    statuses.push(res.status)
  }
  return statuses
}

describe('writeRateLimit', () => {
  it('limits a client that rewrites the forwarded address on every request', async () => {
    const requests = Array.from({ length: WRITE_LIMIT + 1 }, (_, i) => ({
      path: '/books/a',
      forwardedFor: `10.0.0.${i}, 203.0.113.1`,
    }))

    const statuses = await statusesFor(buildApp(), requests)

    expect(statuses.at(-1)).toBe(429)
  })

  it('counts every book id against the same client', async () => {
    const requests = Array.from({ length: WRITE_LIMIT + 1 }, (_, i) => ({
      path: `/books/${i}`,
      forwardedFor: '203.0.113.2',
    }))

    const statuses = await statusesFor(buildApp(), requests)

    expect(statuses.at(-1)).toBe(429)
  })

  it('keeps each client on its own count', async () => {
    const app = buildApp()
    const exhausted = Array.from({ length: WRITE_LIMIT + 1 }, () => ({ path: '/books/a', forwardedFor: '203.0.113.3' }))
    await statusesFor(app, exhausted)

    const [other] = await statusesFor(app, [{ path: '/books/a', forwardedFor: '203.0.113.4' }])

    expect(other).toBe(200)
  })
})
