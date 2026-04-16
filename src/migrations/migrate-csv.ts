/**
 * Script de migração: CSV → MongoDB
 *
 * O que faz:
 *  1. Conecta ao MongoDB e cria permissões padrão (seed)
 *  2. Cria um usuário-sistema para o added_by dos livros migrados
 *  3. Cria os sub-gêneros únicos do CSV
 *  4. Cria (ou encontra) documentos Autor, Midia e Categoria para cada valor único
 *  5. Importa os livros com os ObjectIds corretos para todos os campos ref
 *
 * Uso:
 *  yarn migrate:csv
 *
 * Seguro para rodar múltiplas vezes — usa upsert em tudo.
 *
 * Nota: este script já resolve autor, midia e categoria como ObjectIds.
 * NÃO é necessário rodar migrate:categorias, migrate:autor ou migrate:midia
 * após este script em um banco limpo.
 */

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

/** Upsert genérico para entidades com nome+slug+created_by */
const upsertNamed = async (
  Model: typeof Autor | typeof Midia | typeof Categoria,
  nome: string,
  createdBy: mongoose.Types.ObjectId,
): Promise<mongoose.Types.ObjectId> => {
  const slug = slugify(nome)
  const doc = await (Model as typeof Autor).findOneAndUpdate(
    { slug },
    { $setOnInsert: { nome, slug, created_by: createdBy } },
    { upsert: true, new: true },
  )
  return doc!._id
}

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
      .pipe(parse({ relax_quotes: true, skip_empty_lines: false, trim: true }))
      .on('data', (row: string[]) => {
        if (lineIndex <= HEADER_ROW) {
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
  console.log('🚀 Iniciando migração CSV → MongoDB...\n')

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
    process.exit(1)
  }
  console.log(`   ✅ ${rows.length} livros encontrados\n`)

  // ── 3. Sub-gêneros ─────────────────────────────────────────────
  console.log('🏷️  Criando sub-gêneros...')
  const allSubgeneroNames = [...new Set(rows.flatMap((r) => r.subgeneros))]
  let subCreated = 0,
    subSkipped = 0

  for (const subLower of allSubgeneroNames) {
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

  const subgenerosMap = new Map<string, mongoose.Types.ObjectId>()
  for (const doc of await Subgenero.find().select('slug _id').lean()) {
    subgenerosMap.set(doc.slug, doc._id)
  }
  console.log(`   ✅ ${subCreated} criados, ${subSkipped} já existiam\n`)

  // ── 4. Autores, Mídias, Categorias ────────────────────────────
  console.log('👤 Criando autores, mídias e categorias...')

  const autorMap = new Map<string, mongoose.Types.ObjectId>()
  const midiaMap = new Map<string, mongoose.Types.ObjectId>()
  const categoriaMap = new Map<string, mongoose.Types.ObjectId>()

  const uniqueAutores = [...new Set(rows.map((r) => r.autor).filter(Boolean))]
  const uniqueMidias = [...new Set(rows.map((r) => r.midia).filter(Boolean))]
  const uniqueCategorias = [...new Set(rows.map((r) => r.categoria).filter(Boolean))]

  for (const nome of uniqueAutores) {
    autorMap.set(nome, await upsertNamed(Autor, nome, systemUser._id))
  }
  for (const nome of uniqueMidias) {
    midiaMap.set(nome, await upsertNamed(Midia, nome, systemUser._id))
  }
  for (const nome of uniqueCategorias) {
    categoriaMap.set(nome, await upsertNamed(Categoria, nome, systemUser._id))
  }

  console.log(
    `   ✅ ${uniqueAutores.length} autores, ${uniqueMidias.length} mídias,` +
      ` ${uniqueCategorias.length} categorias\n`,
  )

  // ── 5. Livros ──────────────────────────────────────────────────
  console.log('📚 Importando livros...')
  let bookCreated = 0,
    bookSkipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const autorId = autorMap.get(row.autor)
      const midiaId = midiaMap.get(row.midia)
      const categoriaId = categoriaMap.get(row.categoria)

      if (!autorId || !midiaId || !categoriaId) {
        const missing = [
          !autorId && `autor="${row.autor}"`,
          !midiaId && `midia="${row.midia}"`,
          !categoriaId && `categoria="${row.categoria}"`,
        ]
          .filter(Boolean)
          .join(', ')
        throw new Error(`ObjectId não resolvido para: ${missing}`)
      }

      const subgenerosIds = row.subgeneros
        .map((s) => subgenerosMap.get(slugify(s)))
        .filter((id): id is mongoose.Types.ObjectId => id !== undefined)

      const result = await Book.updateOne(
        { titulo: row.titulo, autor: autorId },
        {
          $setOnInsert: {
            titulo: row.titulo,
            autor: autorId,
            midia: midiaId,
            categoria: categoriaId,
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
  console.log(`   Sub-gêneros → ${subCreated} criados, ${subSkipped} já existiam`)
  console.log(`   Autores     → ${uniqueAutores.length} processados`)
  console.log(`   Mídias      → ${uniqueMidias.length} processadas`)
  console.log(`   Categorias  → ${uniqueCategorias.length} processadas`)
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
