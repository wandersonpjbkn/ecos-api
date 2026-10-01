import express from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { validateCreateBook, validateMemberUpdateBook } from '@/middleware/validate.js'
import { mainAuthorName } from '@/utils/enrichment.js'

const id = () => String(new Types.ObjectId())

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.post('/books', validateCreateBook, (_req, res) => {
    res.status(201).json({ ok: true })
  })
  app.patch('/me/books/:id', validateMemberUpdateBook, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

const book = (authors: unknown) => ({ titulo: 'Boa sorte', authors, categoria: id(), midia: id() })

describe('authors of a book', () => {
  it('takes more than one author', async () => {
    const res = await request(buildApp())
      .post('/books')
      .send(book([id(), id()]))

    expect(res.status).toBe(201)
  })

  it.each([
    ['no list', undefined, 'Falta o autor.'],
    ['an empty list', [], 'Falta o autor.'],
    ['a single id instead of a list', id(), 'Algum autor não é válido.'],
    ['an id that is not one', ['abc'], 'Algum autor não é válido.'],
  ])('refuses %s', async (_case, authors, error) => {
    const res = await request(buildApp()).post('/books').send(book(authors))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe(error)
  })

  it('refuses the same author twice', async () => {
    const author = id()
    const res = await request(buildApp())
      .post('/books')
      .send(book([author, author]))

    expect(res.body.error).toBe('O mesmo autor está duas vezes.')
  })

  it('lets the owner change the authors, like every other field of the book', async () => {
    const res = await request(buildApp())
      .patch('/me/books/1')
      .send({ authors: [id(), id()] })

    expect(res.status).toBe(200)
  })

  it('no longer takes the single author field', async () => {
    const res = await request(buildApp())
      .post('/books')
      .send({ ...book([id()]), autor: id() })

    expect(res.status).toBe(400)
  })
})

describe('mainAuthorName', () => {
  it('searches by the first author, the one a list shows', () => {
    expect(mainAuthorName([{ nome: 'Neil Gaiman' }, { nome: 'Terry Pratchett' }])).toBe(
      'Neil Gaiman',
    )
  })

  it('has no name when the book has no author left', () => {
    expect(mainAuthorName([])).toBeNull()
    expect(mainAuthorName(undefined)).toBeNull()
  })
})
