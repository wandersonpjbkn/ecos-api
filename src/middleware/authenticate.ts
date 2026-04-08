import type { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

import { User } from '@/models/User.js'
import type { AuthRequest, SupabaseJwtPayload } from '@/types/index.ts'

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido.' })
    return
  }

  const token = authHeader.slice(7)
  const secret = process.env.SUPABASE_JWT_SECRET

  if (!secret) {
    console.error('[authenticate] SUPABASE_JWT_SECRET não definida')
    res.status(500).json({ error: 'Erro de configuração do servidor.' })
    return
  }

  let payload: SupabaseJwtPayload

  try {
    payload = jwt.verify(token, secret) as SupabaseJwtPayload
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' })
    return
  }

  try {
    // Busca ou cria o usuário no MongoDB
    let user = await User.findOne({ supabase_uid: payload.sub })

    if (!user) {
      // Primeiro acesso — cria como viewer
      user = await User.create({
        supabase_uid: payload.sub,
        email: payload.email,
        name: payload.email.split('@')[0], // nome provisório até o usuário editar
        role: 'viewer',
        last_seen_at: new Date(),
      })
      console.log(`[authenticate] Novo usuário criado: ${user.email} (viewer)`)
    } else {
      // Atualiza last_seen sem await para não bloquear a request
      User.updateOne({ _id: user._id }, { last_seen_at: new Date() }).exec().catch(() => null)
    }

    req.user = {
      _id: user._id,
      supabase_uid: user.supabase_uid,
      email: user.email,
      name: user.name,
      role: user.role,
    }

    next()
  } catch (err) {
    console.error('[authenticate] Erro ao buscar usuário:', err)
    res.status(500).json({ error: 'Erro interno de autenticação.' })
  }
}
