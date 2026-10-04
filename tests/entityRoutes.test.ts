import express from 'express'
import type { NextFunction, Response } from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Autor } from '@/models/Autor.js'
import { Book } from '@/models/Book.js'
import { Categoria } from '@/models/Categoria.js'
import { Midia } from '@/models/Midia.js'
import { Permission } from '@/models/Permission.js'
import { Subgenero } from '@/models/Subgenero.js'
import authorRoutes from '@/routes/autores.js'
import genreRoutes from '@/routes/categorias.js'
import formatRoutes from '@/routes/midias.js'
import subgenreRoutes from '@/routes/subgeneros.js'
import type { AuthRequest } from '@/types/index.ts'

const userId = new Types.ObjectId()

vi.mock('@/middleware/authenticate.js', () => ({
  authenticate: (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.user = {
      _id: userId,
      supabase_uid: 'uid',
      email: 'editor@ecos.test',
      name: 'Editor',
      role: 'editor',
    }
    next()
  },
}))

const ENTITIES = [
  { path: '/autores', router: authorRoutes, Model: Autor },
  { path: '/categorias', router: genreRoutes, Model: Categoria },
  { path: '/midias', router: formatRoutes, Model: Midia },
  { path: '/subgeneros', router: subgenreRoutes, Model: Subgenero },
]

const buildApp = (path: string, router: express.Router) => {
  const app = express()
  app.use(express.json())
  app.use(path, router)
  return app
}

describe.each(ENTITIES)('$path', ({ path, router, Model }) => {
  const id = String(new Types.ObjectId())
  const model = Model as typeof Autor

  beforeEach(() => {
    vi.spyOn(Permission, 'findOne').mockResolvedValue({
      actions: ['read', 'create', 'update', 'delete'],
    })
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('saves the typed name under the database field nome, with its slug and who created it', async () => {
    vi.spyOn(model, 'findOne').mockResolvedValue(null)
    const create = vi.spyOn(model, 'create').mockImplementation(async (doc) => doc as never)

    const res = await request(buildApp(path, router))
      .post(path)
      .send({ nome: '  Ana Maria Machado ' })

    expect(res.status).toBe(201)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Ana Maria Machado',
        slug: 'ana-maria-machado',
        created_by: userId,
      }),
    )
  })

  it('refuses a name whose slug already exists', async () => {
    const findOne = vi.spyOn(model, 'findOne').mockResolvedValue({ nome: 'Ana Maria Machado' })
    const create = vi.spyOn(model, 'create')

    const res = await request(buildApp(path, router)).post(path).send({ nome: 'Ána Maria Machado' })

    expect(res.status).toBe(409)
    expect(findOne).toHaveBeenCalledWith({ slug: 'ana-maria-machado' })
    expect(create).not.toHaveBeenCalled()
  })

  it('renames under the database field nome, with the new slug', async () => {
    vi.spyOn(model, 'findOne').mockResolvedValue(null)
    const update = vi
      .spyOn(model, 'findByIdAndUpdate')
      .mockResolvedValue({ nome: 'Machado de Assis' } as never)

    const res = await request(buildApp(path, router))
      .patch(`${path}/${id}`)
      .send({ nome: ' Machado de Assis  ' })

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      id,
      { nome: 'Machado de Assis', slug: 'machado-de-assis' },
      { new: true },
    )
  })

  it('answers 404 when the item to rename is gone', async () => {
    vi.spyOn(model, 'findOne').mockResolvedValue(null)
    vi.spyOn(model, 'findByIdAndUpdate').mockResolvedValue(null)

    const res = await request(buildApp(path, router)).patch(`${path}/${id}`).send({ nome: 'Outro' })

    expect(res.status).toBe(404)
  })
})

describe('/autores removal', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps an author that is in the author list of some book', async () => {
    vi.spyOn(Permission, 'findOne').mockResolvedValue({ actions: ['delete'] })
    const inUse = vi.spyOn(Book, 'exists').mockResolvedValue({ _id: new Types.ObjectId() })
    const remove = vi.spyOn(Autor, 'findByIdAndDelete')
    const id = String(new Types.ObjectId())

    const res = await request(buildApp('/autores', authorRoutes)).delete(`/autores/${id}`)

    expect(res.status).toBe(409)
    expect(inUse).toHaveBeenCalledWith({ authors: id })
    expect(remove).not.toHaveBeenCalled()
  })
})
