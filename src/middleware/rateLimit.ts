import { rateLimit } from 'express-rate-limit'

export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitos pedidos seguidos. Tente de novo daqui a pouco.' },
})

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitos pedidos seguidos. Tente de novo daqui a pouco.' },
})

export const writeRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas mudanças seguidas. Espere alguns segundos e tente de novo.' },
})

export const enrichmentRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Muitas buscas de dados seguidas. Espere alguns segundos e tente de novo.',
  },
})

export const keepAliveRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitos pedidos seguidos. Tente de novo daqui a pouco.' },
})
