import { Schema, model, type Types } from 'mongoose'

export const READING_STATUSES = ['quero_ler', 'lido'] as const
export type ReadingStatusValue = (typeof READING_STATUSES)[number]

export interface IReadingStatus {
  user_id: Types.ObjectId
  book_id: Types.ObjectId
  status: ReadingStatusValue
  updated_at: Date
}

const ReadingStatusSchema = new Schema<IReadingStatus>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    book_id: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    status: { type: String, enum: READING_STATUSES, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
)

// One status per person and book: marking a book as read takes it out of "Quero ler".
ReadingStatusSchema.index({ user_id: 1, book_id: 1 }, { unique: true })
ReadingStatusSchema.index({ book_id: 1, status: 1 })

export const ReadingStatus = model<IReadingStatus>('ReadingStatus', ReadingStatusSchema)
