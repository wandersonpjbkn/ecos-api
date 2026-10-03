import 'dotenv/config'

import app, { allowedOrigins } from '@/app.js'
import { connectDB } from '@/config/db.js'
import { migrateBookAuthors } from '@/migrations/book-authors.js'
import { removeBookGoogleId } from '@/migrations/book-google-id.js'
import { removeBulkSearchMarks } from '@/migrations/book-search-marks.js'
import { seedPermissions } from '@/utils/seed.js'

// ── Startup ───────────────────────────────────────────────────────
const start = async () => {
  await connectDB()
  await seedPermissions()
  await migrateBookAuthors()
  await removeBookGoogleId()
  await removeBulkSearchMarks()

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
