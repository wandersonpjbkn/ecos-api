import type { Request } from 'express'
import type { Types } from 'mongoose'

// ── Roles ─────────────────────────────────────────────────────────
export type Role = 'admin' | 'editor' | 'viewer'
export type Resource = 'books' | 'users' | 'subgeneros' | 'permissions'
export type Action = 'create' | 'read' | 'update' | 'delete'

// ── Auth ──────────────────────────────────────────────────────────

/** Payload decodificado do JWT emitido pelo Supabase */
export interface SupabaseJwtPayload {
  sub: string // supabase_uid
  email: string
  exp: number
  iat: number
}

/** Usuário autenticado injetado pelo middleware authenticate */
export interface AuthUser {
  _id: Types.ObjectId
  supabase_uid: string
  email: string
  name: string
  role: Role
}

/** Request com usuário autenticado disponível */
export interface AuthRequest extends Request {
  user?: AuthUser
}

// ── Edit history ──────────────────────────────────────────────────
export interface EditHistoryEntry {
  field: string
  previous_value: string
  edited_at: Date
  edited_by: Types.ObjectId
}
