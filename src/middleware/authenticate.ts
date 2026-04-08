import type { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

import { User } from '@/models/User.js'
import type { AuthRequest, SupabaseJwtPayload } from '@/types/index.ts'

// ── JWKS client (singleton) ───────────────────────────────────────
// Busca a chave pública do Supabase via endpoint JWKS e faz cache
const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 min
})

const getSigningKey = (kid: string): Promise<string> =>
  new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error('Chave não encontrada'))
      resolve(key.getPublicKey())
    })
  })

// ── Middleware ────────────────────────────────────────────────────
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

  if (!process.env.SUPABASE_URL) {
    console.error('[authenticate] SUPABASE_URL não definida')
    res.status(500).json({ error: 'Erro de configuração do servidor.' })
    return
  }

  let payload: SupabaseJwtPayload

  try {
    // Decodifica o header do JWT para obter o kid (key ID)
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string') throw new Error('Token malformado')

    const kid = decoded.header.kid as string | undefined

    // Busca a chave pública correspondente no JWKS do Supabase
    const publicKey = await getSigningKey(kid ?? '')

    payload = jwt.verify(token, publicKey, {
      algorithms: ['ES256'],
    }) as SupabaseJwtPayload
  } catch (err) {
    console.error('[authenticate] Falha na verificação do token:', err)
    res.status(401).json({ error: 'Token inválido ou expirado.' })
    return
  }

  try {
    let user = await User.findOne({ supabase_uid: payload.sub })

    if (!user) {
      user = await User.create({
        supabase_uid: payload.sub,
        email: payload.email,
        name: payload.email.split('@')[0],
        role: 'viewer',
        last_seen_at: new Date(),
      })
      console.log(`[authenticate] Novo usuário criado: ${user.email} (viewer)`)
    } else {
      User.updateOne({ _id: user._id }, { last_seen_at: new Date() })
        .exec()
        .catch(() => null)
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
