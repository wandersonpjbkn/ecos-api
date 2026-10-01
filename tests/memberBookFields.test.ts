import express from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { validateMemberUpdateBook } from '@/middleware/validate.js'
import { Book } from '@/models/Book.js'
import { applyOwnerFields } from '@/utils/bookEdit.js'

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.patch('/me/books/:id', validateMemberUpdateBook, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

describe('validateMemberUpdateBook', () => {
  it('lets the owner edit the publisher, like every other field of the book', async () => {
    const res = await request(buildApp())
      .patch('/me/books/1')
      .send({ publisher: 'Companhia das Letras' })

    expect(res.status).toBe(200)
  })

  it('still keeps who mentioned the book out of the owner edit', async () => {
    const res = await request(buildApp()).patch('/me/books/1').send({ quem_nome: 'Outra pessoa' })

    expect(res.status).toBe(400)
  })
})

describe('applyOwnerFields', () => {
  const book = () =>
    new Book({
      titulo: 'Dom Casmurro',
      authors: [new Types.ObjectId()],
      categoria: new Types.ObjectId(),
      midia: new Types.ObjectId(),
      added_by: new Types.ObjectId(),
      page_count: 256,
      publisher: 'Antiga',
    })

  it('writes the publisher the owner sent', () => {
    const doc = book()
    applyOwnerFields(doc, { publisher: 'Companhia das Letras' })

    expect(doc.publisher).toBe('Companhia das Letras')
  })

  it('unsets a number the owner cleared and leaves out what was not sent', () => {
    const doc = book()
    applyOwnerFields(doc, { page_count: null })

    expect(doc.page_count).toBeUndefined()
    expect(doc.titulo).toBe('Dom Casmurro')
    expect(doc.publisher).toBe('Antiga')
  })
})
