import * as Sentry from '@sentry/node'
import type { Response } from 'express'
import { MongoServerError } from 'mongodb'
import { Error as MongooseError } from 'mongoose'

const getDuplicatedField = (err: MongoServerError): string =>
  Object.keys(err.keyPattern ?? {})[0] ??
  Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0] ??
  'campo único'

// "PUT /books/:id": the route pattern, so the fallback text shared by several routes does not hide which one failed.
const routeOf = (res: Response): string => {
  const req = res.req
  return req ? `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}` : 'unknown'
}

export const handleDataError = (res: Response, err: unknown, fallback: string): void => {
  if (err instanceof MongoServerError && err.code === 11000) {
    const duplicatedField = getDuplicatedField(err)
    res.status(409).json({
      error: `Já existe um com esse ${duplicatedField === 'slug' || duplicatedField === 'nome' ? 'nome' : 'valor'}.`,
    })
    return
  }

  if (err instanceof MongooseError.ValidationError) {
    const details = Object.values(err.errors)
      .map((error) => error.message)
      .join(' ')
      .trim()
    res.status(400).json({ error: details || 'Dados inválidos.' })
    return
  }

  if (err instanceof MongooseError.CastError) {
    res.status(400).json({ error: 'Algum dado não está certo. Confira e tente de novo.' })
    return
  }

  Sentry.captureException(err, { tags: { route: routeOf(res) } })

  res.status(500).json({ error: fallback })
}
