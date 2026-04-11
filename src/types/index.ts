import type { Request } from 'express'
import type { Types } from 'mongoose'

export type Role = 'admin' | 'editor' | 'viewer'
export type Resource =
  | 'books'
  | 'users'
  | 'autores'
  | 'midias'
  | 'categorias'
  | 'subgeneros'
  | 'permissions'
export type Action = 'create' | 'read' | 'update' | 'delete'

export interface SupabaseJwtPayload {
  sub: string
  email: string
  exp: number
  iat: number
}

export interface AuthUser {
  _id: Types.ObjectId
  supabase_uid: string
  email: string
  name: string
  role: Role
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export interface EditHistoryEntry {
  field: string
  previous_value: string
  edited_at: Date
  edited_by: Types.ObjectId
}
