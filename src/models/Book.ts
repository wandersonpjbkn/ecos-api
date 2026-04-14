import { Schema, model, type Types } from 'mongoose'
import type { EditHistoryEntry } from '@/types/index.ts'

export interface IBook {
  titulo: string
  autor: Types.ObjectId // ref → Autor
  categoria: Types.ObjectId // ref → Categoria
  midia: Types.ObjectId // ref → Midia
  subgeneros: Types.ObjectId[] // refs → Subgenero
  quem_nome: string // valor histórico — sempre preservado
  quem_user_id?: Types.ObjectId // preenchido via claim do membro
  porque: string
  added_by: Types.ObjectId
  updated_at: Date

  // Enriquecimento Google Books
  isbn?: string
  cover_url?: string
  synopsis?: string
  page_count?: number
  published_year?: number
  google_books_id?: string
  enriched_at?: Date

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
    autor: { type: Schema.Types.ObjectId, ref: 'Autor', required: true },
    categoria: { type: Schema.Types.ObjectId, ref: 'Categoria', required: true },
    midia: { type: Schema.Types.ObjectId, ref: 'Midia', required: true },
    subgeneros: [{ type: Schema.Types.ObjectId, ref: 'Subgenero' }],
    quem_nome: { type: String, required: true },
    quem_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    porque: { type: String, default: '' },
    added_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    isbn: { type: String },
    cover_url: { type: String },
    synopsis: { type: String },
    page_count: { type: Number },
    published_year: { type: Number },
    google_books_id: { type: String },
    enriched_at: { type: Date },

    edit_history: { type: [EditHistorySchema], default: [] },
  },
  {
    timestamps: { createdAt: 'added_at', updatedAt: 'updated_at' },
  },
)

BookSchema.index({ quem_user_id: 1 })
BookSchema.index({ autor: 1 })
BookSchema.index({ categoria: 1 })
BookSchema.index({ midia: 1 })
BookSchema.index({ subgeneros: 1 })
BookSchema.index({ google_books_id: 1 }, { sparse: true })
BookSchema.index({ isbn: 1 }, { sparse: true })

export const Book = model<IBook>('Book', BookSchema)
