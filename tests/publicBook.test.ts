import express from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Book } from '@/models/Book.js'
import bookRoutes from '@/routes/books.js'

const id = new Types.ObjectId()
const stored = {
  _id: id,
  titulo: 'Dom Casmurro',
  authors: [{ _id: new Types.ObjectId(), nome: 'Machado de Assis', slug: 'machado-de-assis' }],
  quem_user_id: { _id: new Types.ObjectId(), name: 'Ana' },
  porque: 'Releitura',
  cover_url: 'https://example.test/capa.jpg',
  added_at: '2026-09-01T00:00:00.000Z',
  added_by: new Types.ObjectId(),
  edit_history: [
    {
      field: 'titulo',
      previous_value: 'Dom',
      edited_by: new Types.ObjectId(),
      edited_at: new Date(),
    },
  ],
  manually_edited_at: new Date(),
  google_books_id: 'NNozEAAAQBAJ',
  enriched_at: new Date(),
  cover_source: 'google',
  __v: 0,
}

// The query chain the routes build; every step returns the chain, `lean` resolves the stored book.
const query = (result: unknown) => {
  const chain: Record<string, unknown> = {}
  for (const step of ['populate', 'sort', 'select']) chain[step] = () => chain
  chain.lean = () => Promise.resolve(result)
  return chain as never
}

const buildApp = () => express().use('/books', bookRoutes)

const SERVER_ONLY = [
  'added_by',
  'edit_history',
  'manually_edited_at',
  'enriched_at',
  'cover_source',
  'google_books_id',
  '__v',
]

describe('public book responses', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists the catalog without who added or edited each book', async () => {
    vi.spyOn(Book, 'find').mockReturnValue(query([stored]))

    const res = await request(buildApp()).get('/books')

    expect(res.status).toBe(200)
    for (const field of SERVER_ONLY) expect(res.body[0]).not.toHaveProperty(field)
    expect(res.body[0]).toMatchObject({ titulo: 'Dom Casmurro', porque: 'Releitura' })
    expect(res.body[0].quem_user_id).toEqual({ _id: String(stored.quem_user_id._id), name: 'Ana' })
  })

  it('opens one book without who added or edited it', async () => {
    vi.spyOn(Book, 'findById').mockReturnValue(query(stored))

    const res = await request(buildApp()).get(`/books/${id}`)

    expect(res.status).toBe(200)
    for (const field of SERVER_ONLY) expect(res.body).not.toHaveProperty(field)
    expect(res.body.cover_url).toBe(stored.cover_url)
  })
})
