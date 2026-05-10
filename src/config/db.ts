import * as Sentry from '@sentry/node' // NEW
import mongoose from 'mongoose'

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('❌ MONGODB_URI não definida. Encerrando.')
    process.exit(1)
  }

  try {
    await mongoose.connect(uri)
    console.log('✅ MongoDB conectado')
  } catch (err) {
    console.error('❌ Falha ao conectar no MongoDB:', err)

    Sentry.captureException(err)
    await Sentry.flush(5000).catch(() => null)

    process.exit(1)
  }
}
