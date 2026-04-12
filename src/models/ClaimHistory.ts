import { Schema, model, type Types } from 'mongoose'

export interface IClaimHistory {
  action: 'claim' | 'unclaim'
  user_id: Types.ObjectId
  user_email: string
  claim_name?: string
  previous_claim_names?: string[]
  affected_books: number
  performed_at: Date
}

const ClaimHistorySchema = new Schema<IClaimHistory>(
  {
    action: { type: String, enum: ['claim', 'unclaim'], required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    user_email: { type: String, required: true },
    claim_name: { type: String },
    previous_claim_names: { type: [String], default: [] },
    affected_books: { type: Number, required: true },
    performed_at: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
)

ClaimHistorySchema.index({ performed_at: -1 })
ClaimHistorySchema.index({ user_id: 1, performed_at: -1 })

export const ClaimHistory = model<IClaimHistory>('ClaimHistory', ClaimHistorySchema)
