import * as Sentry from '@sentry/node'
import type { Response } from 'express'
import { MongoServerError } from 'mongodb'
import { Error as MongooseError } from 'mongoose'

const getDuplicatedField = (err: MongoServerError): string =>
  Object.keys(err.keyPattern ?? {})[0] ??
  Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0] ??
  'campo único'

export const handleDataError = (res: Response, err: unknown, fallback: string): void => {
  if (err instanceof MongoServerError && err.code === 11000) {
    const duplicatedField = getDuplicatedField(err)
    res.status(409).json({ error: `Valor já cadastrado para ${duplicatedField}.` })
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
    res.status(400).json({ error: `Campo "${err.path}" inválido.` })
    return
  }

  Sentry.captureException(err)

  res.status(500).json({ error: fallback })
}
