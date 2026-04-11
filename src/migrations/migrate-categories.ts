/**
 * Script de migração: categoria string → ObjectId
 *
 * O que faz:
 *  1. Lê todos os livros que ainda têm categoria como string
 *  2. Cria (ou encontra) o documento Categoria correspondente
 *  3. Substitui o campo categoria pelo ObjectId no documento Book
 *
 * Uso:
 *  yarn migrate:categorias
 *
 * Seguro para rodar múltiplas vezes — usa upsert e verifica antes de atualizar.
 *
 * Atenção: rode APÓS atualizar o model Book.ts para categoria: ObjectId.
 * O script lida com o período de transição em que o campo pode ser string ou ObjectId.
 */

import 'dotenv/config'
import mongoose from 'mongoose'

import { connectDB } from '@/config/db.js'
import { Categoria } from '@/models/Categoria.js'
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
  console.log('🚀 Iniciando migração de categorias...\n')

  await connectDB()

  // Usuário-sistema para created_by das categorias criadas automaticamente
  const systemUser = await User.findOne({ supabase_uid: 'system-migration' })
  if (!systemUser) {
    console.error('❌ Usuário-sistema não encontrado. Execute yarn migrate primeiro.')
    process.exit(1)
  }

  // Lê diretamente da coleção para evitar cast error do Mongoose
  // (neste momento categoria ainda pode ser string ou ObjectId)
  const db = mongoose.connection.db
  if (!db) {
    console.error('❌ Conexão com banco não disponível.')
    process.exit(1)
  }

  const books = await db.collection('books').find({}).toArray()
  console.log(`📚 ${books.length} livros encontrados\n`)

  let converted = 0
  let skipped = 0
  let errors = 0

  for (const book of books) {
    const categoriaRaw = book.categoria

    // Já é ObjectId — não precisa migrar
    if (categoriaRaw instanceof mongoose.Types.ObjectId) {
      skipped++
      continue
    }

    // É string — precisa converter
    if (typeof categoriaRaw !== 'string' || !categoriaRaw.trim()) {
      console.warn(`⚠️  "${book.titulo}" sem categoria válida — ignorado`)
      skipped++
      continue
    }

    try {
      const nome = categoriaRaw.trim()
      const slug = slugify(nome)

      // Upsert — cria a categoria se não existir
      const categoria = await Categoria.findOneAndUpdate(
        { slug },
        { $setOnInsert: { nome, slug, created_by: systemUser._id } },
        { upsert: true, new: true },
      )

      // Atualiza o livro com o ObjectId
      await db
        .collection('books')
        .updateOne({ _id: book._id }, { $set: { categoria: categoria!._id } })

      converted++
      console.log(`✅ "${book.titulo}" → categoria "${nome}" (${categoria!._id})`)
    } catch (err) {
      errors++
      console.error(`❌ "${book.titulo}":`, err)
    }
  }

  console.log('\n─────────────────────────────────────')
  console.log('📊 Resumo:')
  console.log(`   Convertidos : ${converted}`)
  console.log(`   Ignorados   : ${skipped}`)
  console.log(`   Erros       : ${errors}`)
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
