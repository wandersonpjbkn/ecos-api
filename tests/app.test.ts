import request from 'supertest'
import { describe, expect, it } from 'vitest'

import app from '@/app.js'

const GLOBAL_LIMIT = 300

// What Render hands the app: the client, then Cloudflare, then its own load balancer.
const renderChain = (client: string) => `${client}, 162.158.0.1, 10.0.0.1`

const exhaust = async (forwardedFor: (i: number) => string) => {
  let last = 0
  for (let i = 0; i <= GLOBAL_LIMIT; i++) {
    const res = await request(app).get('/no-such-route').set('X-Forwarded-For', forwardedFor(i))
    last = res.status
  }
  return last
}

describe('app', () => {
  it('limits every request, even on a route with no limiter of its own', async () => {
    expect(await exhaust(() => renderChain('203.0.113.50'))).toBe(429)
  })

  it('limits a client that writes its own forwarded address before the real one', async () => {
    expect(await exhaust((i) => `10.9.9.${i % 250}, ${renderChain('203.0.113.52')}`)).toBe(429)
  })

  it('keeps two clients behind the same load balancer on separate counts', async () => {
    await exhaust(() => renderChain('203.0.113.53'))

    const res = await request(app).get('/no-such-route').set('X-Forwarded-For', renderChain('203.0.113.54'))

    expect(res.status).toBe(404)
  })

  it('answers a request under the limit normally', async () => {
    const res = await request(app).get('/no-such-route').set('X-Forwarded-For', renderChain('203.0.113.51'))

    expect(res.status).toBe(404)
  })
})
