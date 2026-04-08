import { Schema, model } from 'mongoose'
import type { Role } from '@/types/index.ts'

export interface IUser {
  supabase_uid: string
  email: string
  name: string
  avatar_url?: string
  role: Role
  created_at: Date
  last_seen_at: Date
}

const UserSchema = new Schema<IUser>(
  {
    supabase_uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    avatar_url: { type: String },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'viewer' },
    last_seen_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  },
)

export const User = model<IUser>('User', UserSchema)
