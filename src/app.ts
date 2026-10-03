import * as Sentry from '@sentry/node'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { globalRateLimit } from '@/middleware/rateLimit.js'
import adminRoutes from '@/routes/admin.js'
import authRoutes from '@/routes/auth.js'
import autorRoutes from '@/routes/autores.js'
import bookRoutes from '@/routes/books.js'
import categoriaRoutes from '@/routes/categorias.js'
import healthRoutes from '@/routes/health.js'
import midiaRoutes from '@/routes/midias.js'
import permissionRoutes from '@/routes/permissions.js'
import subgeneroRoutes from '@/routes/subgeneros.js'
import userRoutes from '@/routes/users.js'

// ── CORS ──────────────────────────────────────────────────────────
const CORS_ORIGIN = process.env.CORS_ORIGIN
const LOCAL_CORS_ORIGIN =
  process.env.LOCAL_CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:8080'

if (!CORS_ORIGIN && process.env.NODE_ENV === 'production') {
  console.error('❌ CORS_ORIGIN não definida em produção. Encerrando.')
  process.exit(1)
}

export const allowedOrigins = CORS_ORIGIN
  ? CORS_ORIGIN.split(',').map((o) => o.trim())
  : LOCAL_CORS_ORIGIN.split(',').map((o) => o.trim())

// ── App ───────────────────────────────────────────────────────────
const app = express()

app.set('trust proxy', 3)

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())
app.use(globalRateLimit)

// ── Routes ────────────────────────────────────────────────────────
app.use('/health', healthRoutes)
app.use('/auth', authRoutes)
app.use('/books', bookRoutes)
app.use('/users', userRoutes)
app.use('/autores', autorRoutes)
app.use('/midias', midiaRoutes)
app.use('/categorias', categoriaRoutes)
app.use('/subgeneros', subgeneroRoutes)
app.use('/permissions', permissionRoutes)
app.use('/admin', adminRoutes)

Sentry.setupExpressErrorHandler(app)

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' })
})

export default app
