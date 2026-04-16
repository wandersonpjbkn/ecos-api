import type { Response, NextFunction } from 'express'

import { Permission } from '@/models/Permission.js'
import type { AuthRequest, Resource, Action } from '@/types/index.ts'
import { handleDataError } from '@/utils/httpErrors.js'

/**
 * Fábrica de middleware de autorização.
 * Uso: authorize('books', 'update')
 *
 * Busca as permissões do role do usuário autenticado no banco
 * e verifica se a action solicitada está permitida.
 */
export const authorize =
  (resource: Resource, action: Action) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user

    if (!user) {
      res.status(401).json({ error: 'Não autenticado.' })
      return
    }

    try {
      const permission = await Permission.findOne({ role: user.role, resource })

      if (!permission || !permission.actions.includes(action)) {
        res.status(403).json({
          error: `Sem permissão para ${action} em ${resource}.`,
        })
        return
      }

      next()
    } catch (err) {
      console.error('[authorize] Erro ao verificar permissões:', err)
      handleDataError(res, err, 'Erro ao verificar permissões.')
    }
  }

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' })
    return
  }
  next()
}
