/**
 * Script de migração: midia string → ObjectId
 *
 * Uso:
 *  yarn migrate:midia
 *
 * Seguro para rodar múltiplas vezes — usa upsert e verifica antes de atualizar.
 * Execute APÓS migrate:categorias e APÓS atualizar Book.ts.
 */

import 'dotenv/config'
import mongoose from 'mongoose'

import { connectDB } from '@/config/db.js'
import { Midia } from '@/models/Midia.js'
import { User } from '@/models/User.js'

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')

const run = async () => {
  console.log('🚀 Iniciando migração de midia...\n')

  await connectDB()

  const systemUser = await User.findOne({ supabase_uid: 'system-migration' })
  if (!systemUser) {
    console.error('❌ Usuário-sistema não encontrado. Execute yarn migrate primeiro.')
    process.exit(1)
  }

  const db = mongoose.connection.db
  if (!db) {
    console.error('❌ Conexão com banco não disponível.')
    process.exit(1)
  }

  const books = await db.collection('books').find({}).toArray()

  let converted = 0
  let skipped = 0
  let errors = 0

  console.log('📺 Migrando campo midia...')

  for (const book of books) {
    const raw = book.midia

    if (raw instanceof mongoose.Types.ObjectId) {
      skipped++
      continue
    }

    if (typeof raw !== 'string' || !raw.trim()) {
      console.warn(`⚠️  "${book.titulo}" sem midia válida — ignorado`)
      skipped++
      continue
    }

    try {
      const nome = raw.trim()
      const slug = slugify(nome)

      const doc = await Midia.findOneAndUpdate(
        { slug },
        { $setOnInsert: { nome, slug, created_by: systemUser._id } },
        { upsert: true, new: true },
      )

      await db.collection('books').updateOne({ _id: book._id }, { $set: { midia: doc!._id } })

      converted++
      console.log(`  ✅ "${book.titulo}" → midia: "${nome}" (${doc!._id})`)
    } catch (err) {
      errors++
      console.error(`  ❌ "${book.titulo}":`, err)
    }
  }

  console.log('\n─────────────────────────────────────')
  console.log('📊 Resumo:')
  console.log(`   Mídia → ${converted} convertidos, ${skipped} ignorados, ${errors} erros`)
  console.log(
    errors === 0 ? '\n✅ Migração concluída sem erros!' : '\n⚠️  Migração concluída com erros.',
  )

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
