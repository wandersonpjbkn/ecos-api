import rateLimit from 'express-rate-limit'

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
})

export const enrichmentRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de enriquecimento. Aguarde alguns segundos e tente novamente.' },
})
