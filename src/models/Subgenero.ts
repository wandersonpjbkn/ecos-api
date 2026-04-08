import { Schema, model, type Types } from 'mongoose'

export interface ISubgenero {
  nome: string
  slug: string
  created_at: Date
  created_by: Types.ObjectId
}

const SubgeneroSchema = new Schema<ISubgenero>(
  {
    nome: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
)

export const Subgenero = model<ISubgenero>('Subgenero', SubgeneroSchema)
