import 'dotenv/config'
import { readFileSync } from 'node:fs'
import * as Sentry from '@sentry/node'

const dsn = process.env.SENTRY_DSN
const environment = process.env.NODE_ENV ?? 'development'

let release: string | undefined
try {
  const pkgUrl = new URL('../package.json', import.meta.url)
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version?: string }
  release = pkg.version
} catch {}

if (dsn && environment !== 'development') {
  Sentry.init({
    dsn,
    environment,
    release,

    tracesSampleRate: 0,
    profilesSampleRate: 0,

    sendDefaultPii: false,

    beforeSend(event, hint) {
      const error = hint.originalException

      if (error instanceof Error) {
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
