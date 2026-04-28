import rateLimit from '@/vendor/expressRateLimit.js'

export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
})

export const writeRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas operações de escrita. Aguarde alguns segundos e tente novamente.' },
})

export const enrichmentRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de enriquecimento. Aguarde alguns segundos e tente novamente.',
  },
})

export const keepAliveRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
})
