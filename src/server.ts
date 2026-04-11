import 'dotenv/config'

import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { connectDB } from '@/config/db.js'
import adminRoutes from '@/routes/admin.js'
import authRoutes from '@/routes/auth.js'

import autorRoutes from '@/routes/autores.js'
import bookRoutes from '@/routes/books.js'
import categoriaRoutes from '@/routes/categorias.js'
import midiaRoutes from '@/routes/midias.js'
import permissionRoutes from '@/routes/permissions.js'
import subgeneroRoutes from '@/routes/subgeneros.js'
import userRoutes from '@/routes/users.js'
import { seedPermissions } from '@/utils/seed.js'

// ── CORS ──────────────────────────────────────────────────────────
const CORS_ORIGIN = process.env.CORS_ORIGIN

if (!CORS_ORIGIN && process.env.NODE_ENV === 'production') {
  console.error('❌ CORS_ORIGIN não definida em produção. Encerrando.')
  process.exit(1)
}

const allowedOrigins = CORS_ORIGIN
  ? CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:8080']

// ── App ───────────────────────────────────────────────────────────
const app = express()

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())

// ── Rotas ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/auth', authRoutes)
app.use('/books', bookRoutes)
app.use('/users', userRoutes)
app.use('/autores', autorRoutes)
app.use('/midias', midiaRoutes)
app.use('/categorias', categoriaRoutes)
app.use('/subgeneros', subgeneroRoutes)
app.use('/permissions', permissionRoutes)
app.use('/admin', adminRoutes)

// ── 404 ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' })
})

// ── Inicialização ─────────────────────────────────────────────────
const start = async () => {
  await connectDB()
  await seedPermissions()

  const PORT = Number(process.env.API_PORT ?? 3000)
  const HOST = process.env.API_LOCALHOST

  if (process.env.NODE_ENV === 'development' && HOST) {
    app.listen(PORT, HOST, () => {
      console.log(`🚀 ecos-api rodando em http://${HOST}:${PORT}`)
      console.log(`   CORS permitido: ${allowedOrigins.join(', ')}`)
    })
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 ecos-api rodando na porta ${PORT}`)
    })
  }
}

start()
