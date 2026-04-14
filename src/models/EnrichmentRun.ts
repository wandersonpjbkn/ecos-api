import { Schema, model, type Types } from 'mongoose'

type EnrichmentItemStatus = 'enriched' | 'not_found' | 'failed'
type EnrichmentStrategy =
  | 'isbn'
  | 'title_author_pt'
  | 'title_author'
  | 'openlibrary_isbn'
  | 'openlibrary_title_author'

interface EnrichmentRunItem {
  book_id: Types.ObjectId
  titulo: string
  status: EnrichmentItemStatus
  strategy?: EnrichmentStrategy
  cover_url?: string
  error?: string
}

export interface IEnrichmentRun {
  started_at: Date
  finished_at: Date
  force: boolean
  initiated_by: Types.ObjectId
  initiated_by_email: string
  total: number
  enriched: number
  skipped: number
  failed: number
  coverage_pct_after: number
  results: EnrichmentRunItem[]
}

const EnrichmentRunItemSchema = new Schema<EnrichmentRunItem>(
  {
    book_id: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    titulo: { type: String, required: true },
    status: { type: String, enum: ['enriched', 'not_found', 'failed'], required: true },
    strategy: {
      type: String,
      enum: ['isbn', 'title_author_pt', 'title_author', 'openlibrary_isbn', 'openlibrary_title_author'],
    },
    cover_url: { type: String },
    error: { type: String },
  },
  { _id: false },
)

const EnrichmentRunSchema = new Schema<IEnrichmentRun>(
  {
    started_at: { type: Date, required: true },
    finished_at: { type: Date, required: true },
    force: { type: Boolean, required: true },
    initiated_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    initiated_by_email: { type: String, required: true },
    total: { type: Number, required: true },
    enriched: { type: Number, required: true },
    skipped: { type: Number, required: true },
    failed: { type: Number, required: true },
    coverage_pct_after: { type: Number, required: true },
    results: { type: [EnrichmentRunItemSchema], default: [] },
  },
  {
    versionKey: false,
  },
)

EnrichmentRunSchema.index({ finished_at: -1 })
EnrichmentRunSchema.index({ initiated_by: 1, finished_at: -1 })

export const EnrichmentRun = model<IEnrichmentRun>('EnrichmentRun', EnrichmentRunSchema)
