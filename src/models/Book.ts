import { Schema, model, type Types } from 'mongoose'
import type { EditHistoryEntry } from '@/types/index.ts'

export interface IBook {
  // Dados do clube
  titulo: string
  autor: string
  categoria: string
  midia: 'Livro' | 'Mangá' | 'HQ'
  subgeneros: Types.ObjectId[] // refs → Subgenero
  quem_nome: string // valor histórico — sempre preservado
  quem_user_id?: Types.ObjectId // preenchido quando o membro criar conta
  porque: string
  added_by: Types.ObjectId // quem cadastrou no sistema
  updated_at: Date

  // Enriquecimento Google Books
  isbn?: string
  cover_url?: string
  synopsis?: string
  page_count?: number
  published_year?: number
  google_books_id?: string
  enriched_at?: Date

  // Auditoria de edições
  edit_history: EditHistoryEntry[]
}

const EditHistorySchema = new Schema<EditHistoryEntry>(
  {
    field: { type: String, required: true },
    previous_value: { type: String, required: true },
    edited_at: { type: Date, required: true },
    edited_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
)

const BookSchema = new Schema<IBook>(
  {
    titulo: { type: String, required: true },
    autor: { type: String, required: true },
    categoria: { type: String, required: true },
    midia: { type: String, enum: ['Livro', 'Mangá', 'HQ'], required: true },
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

// Índices
BookSchema.index({ quem_user_id: 1 })
BookSchema.index({ categoria: 1 })
BookSchema.index({ subgeneros: 1 })
BookSchema.index({ google_books_id: 1 }, { sparse: true })

export const Book = model<IBook>('Book', BookSchema)
