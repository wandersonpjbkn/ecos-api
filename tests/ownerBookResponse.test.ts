import express from 'express'
import type { NextFunction, Response } from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Book } from '@/models/Book.js'
import userRoutes from '@/routes/users.js'
import type { AuthRequest } from '@/types/index.ts'

const ownerId = new Types.ObjectId()

vi.mock('@/middleware/authenticate.js', () => ({
  authenticate: (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.user = {
      _id: ownerId,
      supabase_uid: 'uid',
      email: 'dona@ecos.test',
      name: 'Dona',
      role: 'viewer',
    }
    next()
  },
}))

describe('PATCH /users/me/books/:id', () => {
  afterEach(() => vi.restoreAllMocks())

  it('answers the owner without who else added or edited the book', async () => {
    const book = new Book({
      titulo: 'Dom Casmurro',
      authors: [new Types.ObjectId()],
      categoria: new Types.ObjectId(),
      midia: new Types.ObjectId(),
      quem_user_id: ownerId,
      added_by: new Types.ObjectId(),
      edit_history: [
        {
          field: 'titulo',
          previous_value: 'Dom',
          edited_at: new Date(),
          edited_by: new Types.ObjectId(),
        },
      ],
    })
    vi.spyOn(Book, 'findById').mockResolvedValue(book)
    vi.spyOn(book, 'save').mockResolvedValue(book)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const res = await request(express().use(express.json()).use('/users', userRoutes))
      .patch(`/users/me/books/${book._id}`)
      .send({ publisher: 'Garnier' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ titulo: 'Dom Casmurro', publisher: 'Garnier' })
    for (const field of ['added_by', 'edit_history', 'manually_edited_at', '__v']) {
      expect(res.body).not.toHaveProperty(field)
    }
  })
})
