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
import healthRoutes from '@/routes/health.js'
import { seedPermissions } from '@/utils/seed.js'

// ── CORS ──────────────────────────────────────────────────────────
const CORS_ORIGIN = process.env.CORS_ORIGIN
const LOCAL_CORS_ORIGIN =
  process.env.LOCAL_CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:8080'

if (!CORS_ORIGIN && process.env.NODE_ENV === 'production') {
  console.error('❌ CORS_ORIGIN não definida em produção. Encerrando.')
  process.exit(1)
}

const allowedOrigins = CORS_ORIGIN
  ? CORS_ORIGIN.split(',').map((o) => o.trim())
  : LOCAL_CORS_ORIGIN.split(',').map((o) => o.trim())

// ── App ───────────────────────────────────────────────────────────
const app = express()

app.use(helmet())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())

// ── Rotas ─────────────────────────────────────────────────────────
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
      console.log(`🚀 [ ecos-api ] rodando localmente em http://${HOST}:${PORT}`)
      console.log(`📱 Acesse pelo celular em http://192.168.15.12:${PORT}`)
      console.log(`🔗 CORS permitido: ${allowedOrigins.join(', ')}`)
    })
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 [ Servidor Ecos ] rodando na porta ${PORT}`)
    })
  }
}

start()
