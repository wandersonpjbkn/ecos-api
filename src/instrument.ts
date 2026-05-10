/**
 * CRITICAL: This file MUST be the first import of `server.ts`, before any
 * other module. Sentry's auto-instrumentation hooks Node's module loader;
 * if Express, Mongoose or any HTTP client loads first, their internals
 * won't be traced.
 *
 * In ESM (NodeNext), top-level imports are resolved depth-first in source
 * order — so placing this as the first import statement is sufficient.
 *
 * dotenv is loaded inside this file so that SENTRY_DSN is available when
 * Sentry.init runs. server.ts can keep its own `import 'dotenv/config'`;
 * the second call is a no-op.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN
const environment = process.env.NODE_ENV ?? 'development'

// Read package.json version at startup for the release tag.
// Works in both dev (src/instrument.ts) and prod (dist/instrument.js)
// because the relative path to package.json is the same.
let release: string | undefined
try {
  const pkgUrl = new URL('../package.json', import.meta.url)
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version?: string }
  release = pkg.version
} catch {
  // Non-fatal: Sentry just won't have a release tag.
}

if (dsn && environment !== 'development') {
  Sentry.init({
    dsn,
    environment,
    release,

    // Errors only on free tier. Tracing/profiling consume the same quota.
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // LGPD-conscious: opt-in to PII (request bodies, IPs) only when needed.
    sendDefaultPii: false,

    /**
     * Quota guard. Drop expected/handled errors before they count against
     * the 5k events/month budget.
     */
    beforeSend(event, hint) {
      const error = hint.originalException

      if (error instanceof Error) {
        // Drop expected auth failures (token expiry, malformed token).
        // The authenticate middleware already responds 401 to the client.
        if (error.message?.includes('jwt expired')) return null
        if (error.message?.includes('invalid signature')) return null
        if (error.message?.includes('jwt malformed')) return null
        if (error.message === 'Token malformado') return null
        if (error.message === 'Chave não encontrada') return null
      }

      return event
    },
  })
}
