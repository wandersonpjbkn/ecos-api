import { Router } from 'express'
import type { Response } from 'express'

import { authRateLimit, writeRateLimit } from '@/middleware/rateLimit.js'
import { validateObjectId } from '@/middleware/validate.js'
import { Book } from '@/models/Book.js'
import { READING_STATUSES, ReadingStatus, type ReadingStatusValue } from '@/models/ReadingStatus.js'
import type { AuthRequest } from '@/types/index.ts'
import { handleDataError } from '@/utils/httpErrors.js'

const isReadingStatus = (value: unknown): value is ReadingStatusValue =>
  typeof value === 'string' && (READING_STATUSES as readonly string[]).includes(value)

const router = Router()

// ── GET /users/me/reading ────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const entries = await ReadingStatus.find({ user_id: req.user!._id })
      .select('book_id status updated_at -_id')
      .sort({ updated_at: -1 })
      .lean()

    res.json(entries)
  } catch (err) {
    console.error('[GET /users/me/reading]', err)
    handleDataError(res, err, 'Não foi possível abrir sua lista. Tente de novo.')
  }
})

// ── PUT /users/me/reading/:bookId ────────────────────────────────
router.put(
  '/:bookId',
  authRateLimit,
  writeRateLimit,
  validateObjectId('bookId'),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = req.body?.status
      if (!isReadingStatus(status)) {
        res.status(400).json({ error: 'Não foi possível salvar na sua lista. Tente de novo.' })
        return
      }

      if (!(await Book.exists({ _id: req.params.bookId }))) {
        res.status(404).json({ error: 'Não achamos esse livro. Ele pode ter saído do catálogo.' })
        return
      }

      const entry = await ReadingStatus.findOneAndUpdate(
        { user_id: req.user!._id, book_id: req.params.bookId },
        { status, updated_at: new Date() },
        {
          upsert: true,
          new: true,
          runValidators: true,
          projection: { book_id: 1, status: 1, updated_at: 1, _id: 0 },
        },
      ).lean()

      res.json(entry)
    } catch (err) {
      console.error('[PUT /users/me/reading/:bookId]', err)
      handleDataError(res, err, 'Não foi possível salvar na sua lista. Tente de novo.')
    }
  },
)

// ── DELETE /users/me/reading/:bookId ─────────────────────────────
router.delete(
  '/:bookId',
  authRateLimit,
  writeRateLimit,
  validateObjectId('bookId'),
  async (req: AuthRequest, res: Response) => {
    try {
      await ReadingStatus.deleteOne({ user_id: req.user!._id, book_id: req.params.bookId })
      res.status(204).end()
    } catch (err) {
      console.error('[DELETE /users/me/reading/:bookId]', err)
      handleDataError(res, err, 'Não foi possível tirar da sua lista. Tente de novo.')
    }
  },
)

export default router
