import { Schema, model, type Types } from 'mongoose'
import type { EditHistoryEntry } from '@/types/index.ts'

export interface IBook {
  titulo: string
  authors: Types.ObjectId[] // refs → Autor; the first is the one a list shows
  categoria: Types.ObjectId // ref → Categoria
  midia: Types.ObjectId // ref → Midia
  subgeneros: Types.ObjectId[] // refs → Subgenero
  quem_nome?: string | null // valor histórico — sempre preservado
  quem_user_id?: Types.ObjectId | null // preenchido via claim do membro
  porque: string
  added_by: Types.ObjectId
  updated_at: Date

  // Enriquecimento (Google Books / Open Library fallback)
  isbn?: string
  // Who gave the ISBN: a person, or a search (maybe another edition); absent is unknown, not confirmed.
  isbn_source?: 'person' | 'search'
  cover_url?: string
  cover_source?: 'manual' | 'google' | 'openlibrary'
  synopsis?: string
  publisher?: string
  page_count?: number
  published_year?: number
  enriched_at?: Date
  manually_edited_at?: Date | null

  edit_history: EditHistoryEntry[]
}

const EditHistorySchema = new Schema<EditHistoryEntry>(
  {
    field: { type: String, required: true },
    // Pode ficar vazio quando o campo não existia antes (ex.: primeiro ISBN adicionado)
    previous_value: { type: String, default: '' },
    edited_at: { type: Date, required: true },
    edited_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
)

const BookSchema = new Schema<IBook>(
  {
    titulo: { type: String, required: true },
    authors: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Autor' }],
      validate: { validator: (ids: Types.ObjectId[]) => ids.length > 0, message: 'Falta o autor.' },
    },
    categoria: { type: Schema.Types.ObjectId, ref: 'Categoria', required: true },
    midia: { type: Schema.Types.ObjectId, ref: 'Midia', required: true },
    subgeneros: [{ type: Schema.Types.ObjectId, ref: 'Subgenero' }],
    // A placeholder from the first load; a book added since is credited to an account (quem_user_id) instead.
    quem_nome: { type: String, default: undefined },
    quem_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    porque: { type: String, default: '' },
    added_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    isbn: { type: String },
    isbn_source: { type: String, enum: ['person', 'search'] },
    cover_url: { type: String },
    cover_source: { type: String, enum: ['manual', 'google', 'openlibrary'] },
    synopsis: { type: String },
    publisher: { type: String },
    page_count: { type: Number },
    published_year: { type: Number },
    enriched_at: { type: Date },
    manually_edited_at: { type: Date, default: null },

    edit_history: { type: [EditHistorySchema], default: [] },
  },
  {
    timestamps: { createdAt: 'added_at', updatedAt: 'updated_at' },
  },
)

BookSchema.index({ quem_user_id: 1 })
BookSchema.index({ authors: 1 })
BookSchema.index({ categoria: 1 })
BookSchema.index({ midia: 1 })
BookSchema.index({ subgeneros: 1 })
BookSchema.index({ isbn: 1 }, { sparse: true })

// Every book is mentioned by someone: a placeholder from the first load or an account (fatia 8c).
BookSchema.pre('validate', function () {
  if (!this.quem_nome && !this.quem_user_id)
    this.invalidate('quem_nome', 'Escolha quem mencionou o livro.')
})

export const Book = model<IBook>('Book', BookSchema)
