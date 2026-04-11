/**
 * Script de migração: CSV → MongoDB
 *
 * O que faz:
 *  1. Conecta ao MongoDB
 *  2. Cria as permissões padrão (seed)
 *  3. Cria um usuário-sistema para o added_by dos livros migrados
 *  4. Cria os 100 sub-gêneros únicos do CSV
 *  5. Importa os 87 livros resolvendo os ObjectIds dos sub-gêneros
 *
 * Uso:
 *  yarn migrate:csv
 *
 * Seguro para rodar múltiplas vezes — usa upsert em tudo.
 */

import 'dotenv/config'
import { createReadStream } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse'
import mongoose from 'mongoose'

import { connectDB } from '@/config/db.js'
import { Book } from '@/models/Book.js'
import { Subgenero } from '@/models/Subgenero.js'
import { User } from '@/models/User.js'
import { seedPermissions } from '@/utils/seed.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Configuração ──────────────────────────────────────────────────

/**
 * Caminho para o CSV.
 * Coloque o arquivo em ecos-api/data/ antes de rodar.
 */
const CSV_PATH = resolve(__dirname, '../../data/csv-data.csv')

/** Linha onde começa o header real no CSV (0-indexed) */
const HEADER_ROW = 5

/** Usuário-sistema usado como added_by nos livros migrados */
const SYSTEM_USER = {
  supabase_uid: 'system-migration',
  email: 'system@ecos-literarios.internal',
  name: 'Migração CSV',
  role: 'admin' as const,
}

// ── Helpers ───────────────────────────────────────────────────────

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')

interface CsvRow {
  titulo: string
  autor: string
  midia: string
  categoria: string
  subgeneros: string[]
  quem_nome: string
  porque: string
}

const parseCSV = (filePath: string): Promise<CsvRow[]> =>
  new Promise((resolvePromise, reject) => {
    const rows: CsvRow[] = []
    let lineIndex = 0

    createReadStream(filePath)
      .pipe(
        parse({
          relax_quotes: true,
          skip_empty_lines: false,
          trim: true,
        }),
      )
      .on('data', (row: string[]) => {
        if (lineIndex < HEADER_ROW) {
          lineIndex++
          return
        }
        if (lineIndex === HEADER_ROW) {
          lineIndex++
          return
        }
        lineIndex++

        const titulo = row[1]?.trim()
        const autor = row[2]?.trim()
        const midia = row[3]?.trim()

        if (!titulo || !autor || !midia) return

        rows.push({
          titulo,
          autor,
          midia,
          categoria: row[4]?.trim() ?? '',
          subgeneros: (row[5] ?? '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          quem_nome: row[6]?.trim() ?? '',
          porque: row[7]?.trim() ?? '',
        })
      })
      .on('end', () => resolvePromise(rows))
      .on('error', reject)
  })

// ── Migração ──────────────────────────────────────────────────────

const run = async () => {
  console.log('🚀 Iniciando migração...\n')

  await connectDB()
  await seedPermissions()

  // ── 1. Usuário-sistema ─────────────────────────────────────────
  console.log('👤 Criando usuário-sistema...')

  const systemUser = await User.findOneAndUpdate(
    { supabase_uid: SYSTEM_USER.supabase_uid },
    { $setOnInsert: { ...SYSTEM_USER, last_seen_at: new Date() } },
    { upsert: true, new: true },
  )

  console.log(`   ✅ ${systemUser.email} (${systemUser._id})\n`)

  // ── 2. Parsear CSV ─────────────────────────────────────────────
  console.log(`📄 Lendo CSV: ${CSV_PATH}`)

  let rows: CsvRow[]
  try {
    rows = await parseCSV(CSV_PATH)
  } catch (err) {
    console.error('❌ Erro ao ler CSV:', err)
    console.error(`   Verifique se o arquivo existe em: ${CSV_PATH}`)
    process.exit(1)
  }

  console.log(`   ✅ ${rows.length} livros encontrados\n`)

  // ── 3. Sub-gêneros ─────────────────────────────────────────────
  console.log('🏷️  Criando sub-gêneros...')

  const allSubgeneros = [...new Set(rows.flatMap((r) => r.subgeneros))]
  let subCreated = 0
  let subSkipped = 0

  for (const subLower of allSubgeneros) {
    const slug = slugify(subLower)
    const nome = subLower.replace(/\b\w/g, (c) => c.toUpperCase())

    const result = await Subgenero.updateOne(
      { slug },
      { $setOnInsert: { nome, slug, created_by: systemUser._id } },
      { upsert: true },
    )

    if (result.upsertedCount > 0) subCreated++
    else subSkipped++
  }

  console.log(`   ✅ ${subCreated} criados, ${subSkipped} já existiam\n`)

  // Cache slug → ObjectId
  const subgenerosMap = new Map<string, mongoose.Types.ObjectId>()
  const allDocs = await Subgenero.find().select('slug _id').lean()
  for (const doc of allDocs) {
    subgenerosMap.set(doc.slug, doc._id)
  }

  // ── 4. Livros ──────────────────────────────────────────────────
  console.log('📚 Importando livros...')

  let bookCreated = 0
  let bookSkipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const subgenerosIds = row.subgeneros
        .map((s) => {
          const slug = slugify(s)
          const id = subgenerosMap.get(slug)
          if (!id) console.warn(`   ⚠️  Sub-gênero não mapeado: "${s}" (slug: ${slug})`)
          return id
        })
        .filter((id): id is mongoose.Types.ObjectId => id !== undefined)

      const result = await Book.updateOne(
        { titulo: row.titulo, autor: row.autor },
        {
          $setOnInsert: {
            titulo: row.titulo,
            autor: row.autor,
            midia: row.midia,
            categoria: row.categoria,
            subgeneros: subgenerosIds,
            quem_nome: row.quem_nome,
            porque: row.porque,
            added_by: systemUser._id,
            edit_history: [],
          },
        },
        { upsert: true },
      )

      if (result.upsertedCount > 0) {
        bookCreated++
        console.log(`   ✅ "${row.titulo}"`)
      } else {
        bookSkipped++
        console.log(`   ⏭️  "${row.titulo}" (já existe)`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`"${row.titulo}": ${msg}`)
      console.error(`   ❌ "${row.titulo}": ${msg}`)
    }
  }

  // ── Resumo ─────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────')
  console.log('📊 Resumo da migração:')
  console.log(`   Sub-gêneros  → ${subCreated} criados, ${subSkipped} já existiam`)
  console.log(`   Livros       → ${bookCreated} criados, ${bookSkipped} já existiam`)

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} erro(s):`)
    errors.forEach((e) => console.log(`   ${e}`))
  } else {
    console.log('\n✅ Migração concluída sem erros!')
  }

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
