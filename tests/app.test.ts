import request from 'supertest'
import { describe, expect, it } from 'vitest'

import app from '@/app.js'

const GLOBAL_LIMIT = 300

describe('app', () => {
  it('limits every request, even on a route with no limiter of its own', async () => {
    let last = 0
    for (let i = 0; i <= GLOBAL_LIMIT; i++) {
      const res = await request(app).get('/no-such-route').set('X-Forwarded-For', `10.0.1.${i % 250}, 203.0.113.50`)
      last = res.status
    }

    expect(last).toBe(429)
  })

  it('answers a request under the limit normally', async () => {
    const res = await request(app).get('/no-such-route').set('X-Forwarded-For', '203.0.113.51')

    expect(res.status).toBe(404)
  })
})
