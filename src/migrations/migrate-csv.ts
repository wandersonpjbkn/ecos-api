import 'dotenv/config'
import { createReadStream } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse'
import mongoose from 'mongoose'

import { connectDB } from '@/config/db.js'
import { Autor } from '@/models/Autor.js'
import { Book } from '@/models/Book.js'
import { Categoria } from '@/models/Categoria.js'
import { Midia } from '@/models/Midia.js'
import { Subgenero } from '@/models/Subgenero.js'
import { User } from '@/models/User.js'
import { slugify } from '@/utils/global.js'
import { seedPermissions } from '@/utils/seed.js'

interface CsvRow {
  titulo: string
  autor: string
  midia: string
  categoria: string
  subgeneros: string[]
  quem_nome: string
  porque: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))

const CSV_PATH = resolve(__dirname, '../../data/csv-data.csv')
const HEADER_ROW = 5

const SYSTEM_USER = {
  supabase_uid: 'system-migration',
  email: 'system@ecos-literarios.internal',
  name: 'Migração CSV',
  role: 'admin' as const,
}

// ── Helpers ───────────────────────────────────────────────────────

const upsertNamed = async (
  Model: typeof Autor | typeof Midia | typeof Categoria,
  name: string,
  createdBy: mongoose.Types.ObjectId,
): Promise<mongoose.Types.ObjectId> => {
  const slug = slugify(name)
  const doc = await (Model as typeof Autor).findOneAndUpdate(
    { slug },
    { $setOnInsert: { nome: name, slug, created_by: createdBy } },
    { upsert: true, new: true },
  )
  return doc!._id
}

const parseCSV = (filePath: string): Promise<CsvRow[]> =>
  new Promise((resolvePromise, reject) => {
    const rows: CsvRow[] = []
    let lineIndex = 0

    createReadStream(filePath)
      .pipe(parse({ relax_quotes: true, skip_empty_lines: false, trim: true }))
      .on('data', (row: string[]) => {
        if (lineIndex <= HEADER_ROW) {
          lineIndex++
          return
        }
        lineIndex++

        const title = row[1]?.trim()
        const author = row[2]?.trim()
        const format = row[3]?.trim()

        if (!title || !author || !format) return

        rows.push({
          titulo: title,
          autor: author,
          midia: format,
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

// ── Migration ──────────────────────────────────────────────────────

const run = async () => {
  console.log('🚀 Iniciando migração CSV → MongoDB...\n')

  await connectDB()
  await seedPermissions()

  console.log('👤 Criando usuário-sistema...')
  const systemUser = await User.findOneAndUpdate(
    { supabase_uid: SYSTEM_USER.supabase_uid },
    { $setOnInsert: { ...SYSTEM_USER, last_seen_at: new Date() } },
    { upsert: true, new: true },
  )
  console.log(`   ✅ ${systemUser.email} (${systemUser._id})\n`)

  console.log(`📄 Lendo CSV: ${CSV_PATH}`)
  let rows: CsvRow[]
  try {
    rows = await parseCSV(CSV_PATH)
  } catch (err) {
    console.error('❌ Erro ao ler CSV:', err)
    process.exit(1)
  }
  console.log(`   ✅ ${rows.length} livros encontrados\n`)

  console.log('🏷️  Criando sub-gêneros...')
  const allSubgenreNames = [...new Set(rows.flatMap((r) => r.subgeneros))]
  let subCreated = 0,
    subSkipped = 0

  for (const subLower of allSubgenreNames) {
    const slug = slugify(subLower)
    const name = subLower.replace(/\b\w/g, (c) => c.toUpperCase())
    const result = await Subgenero.updateOne(
      { slug },
      { $setOnInsert: { nome: name, slug, created_by: systemUser._id } },
      { upsert: true },
    )
    if (result.upsertedCount > 0) subCreated++
    else subSkipped++
  }

  const subgenreMap = new Map<string, mongoose.Types.ObjectId>()
  for (const doc of await Subgenero.find().select('slug _id').lean()) {
    subgenreMap.set(doc.slug, doc._id)
  }
  console.log(`   ✅ ${subCreated} criados, ${subSkipped} já existiam\n`)

  console.log('👤 Criando autores, mídias e categorias...')

  const authorMap = new Map<string, mongoose.Types.ObjectId>()
  const formatMap = new Map<string, mongoose.Types.ObjectId>()
  const genreMap = new Map<string, mongoose.Types.ObjectId>()

  const uniqueAuthors = [...new Set(rows.map((r) => r.autor).filter(Boolean))]
  const uniqueFormats = [...new Set(rows.map((r) => r.midia).filter(Boolean))]
  const uniqueGenres = [...new Set(rows.map((r) => r.categoria).filter(Boolean))]

  for (const name of uniqueAuthors) {
    authorMap.set(name, await upsertNamed(Autor, name, systemUser._id))
  }
  for (const name of uniqueFormats) {
    formatMap.set(name, await upsertNamed(Midia, name, systemUser._id))
  }
  for (const name of uniqueGenres) {
    genreMap.set(name, await upsertNamed(Categoria, name, systemUser._id))
  }

  console.log(
    `   ✅ ${uniqueAuthors.length} autores, ${uniqueFormats.length} mídias,` +
      ` ${uniqueGenres.length} categorias\n`,
  )

  console.log('📚 Importando livros...')
  let bookCreated = 0,
    bookSkipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const authorId = authorMap.get(row.autor)
      const formatId = formatMap.get(row.midia)
      const genreId = genreMap.get(row.categoria)

      if (!authorId || !formatId || !genreId) {
        const missing = [
          !authorId && `autor="${row.autor}"`,
          !formatId && `midia="${row.midia}"`,
          !genreId && `categoria="${row.categoria}"`,
        ]
          .filter(Boolean)
          .join(', ')
        throw new Error(`ObjectId não resolvido para: ${missing}`)
      }

      const subgenreIds = row.subgeneros
        .map((s) => subgenreMap.get(slugify(s)))
        .filter((id): id is mongoose.Types.ObjectId => id !== undefined)

      const result = await Book.updateOne(
        { titulo: row.titulo, authors: authorId },
        {
          $setOnInsert: {
            titulo: row.titulo,
            authors: [authorId],
            midia: formatId,
            categoria: genreId,
            subgeneros: subgenreIds,
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

  // ── Summary ─────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────')
  console.log('📊 Resumo da migração:')
  console.log(`   Sub-gêneros → ${subCreated} criados, ${subSkipped} já existiam`)
  console.log(`   Autores     → ${uniqueAuthors.length} processados`)
  console.log(`   Mídias      → ${uniqueFormats.length} processadas`)
  console.log(`   Categorias  → ${uniqueGenres.length} processadas`)
  console.log(`   Livros      → ${bookCreated} criados, ${bookSkipped} já existiam`)

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
