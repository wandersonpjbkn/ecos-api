import express from 'express'
import type { NextFunction, Response } from 'express'
import { Types } from 'mongoose'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Permission } from '@/models/Permission.js'
import bookRoutes from '@/routes/books.js'
import type { AuthRequest } from '@/types/index.ts'

vi.mock('@/middleware/authenticate.js', () => ({
  authenticate: (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.user = {
      _id: new Types.ObjectId(),
      supabase_uid: 'uid',
      email: 'editor@ecos.test',
      name: 'Editor',
      role: 'editor',
    }
    next()
  },
}))

const volume = (i: number, language = 'pt') => ({
  id: `vol${i}`,
  volumeInfo: {
    title: `Dom Casmurro ${i}`,
    authors: ['Machado de Assis'],
    language,
    publisher: 'Garnier',
    pageCount: 256,
    publishedDate: '1899-01-01',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: `978850000000${i}` }],
    imageLinks: { thumbnail: `http://books.google.com/books/content?id=vol${i}` },
  },
})

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const google = (items: unknown[]) => json({ totalItems: items.length, items })
const openLibrary = (docs: unknown[]) => json({ numFound: docs.length, docs })

const buildApp = () => express().use(express.json()).use('/books', bookRoutes)
const search = (body: Record<string, unknown>) =>
  request(buildApp()).post('/books/enrich/search').send(body)

describe('POST /books/enrich/search', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.spyOn(Permission, 'findOne').mockResolvedValue({ actions: ['create'] })
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('answers up to five Google books, in the order Google gave, with the language', async () => {
    fetchMock.mockReturnValue(google([1, 2, 3, 4, 5].map((i) => volume(i))))

    const res = await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })

    expect(res.status).toBe(200)
    expect(res.body.source).toBe('google_books')
    expect(res.body.candidates.map((c: { volume_id: string }) => c.volume_id)).toEqual([
      'vol1',
      'vol2',
      'vol3',
      'vol4',
      'vol5',
    ])
    expect(res.body.candidates[0]).toMatchObject({
      title: 'Dom Casmurro 1',
      authors: ['Machado de Assis'],
      language: 'pt',
      publisher: 'Garnier',
      page_count: 256,
      published_year: 1899,
      isbn: '9788500000001',
      cover_url: 'https://books.google.com/books/content?id=vol1',
    })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('maxResults=5')
  })

  it('asks Google for the title and the author as plain text', async () => {
    fetchMock.mockReturnValue(google([volume(1)]))

    await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })

    const url = decodeURIComponent(String(fetchMock.mock.calls[0]![0]))
    expect(url).toContain('q=Dom Casmurro Machado de Assis')
    expect(url).not.toContain('intitle:')
  })

  it('leaves out an Open Library ISBN or language when the work has several', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('openlibrary')
        ? openLibrary([
            {
              key: '/works/OL1W',
              title: 'Dom Casmurro',
              author_name: ['Machado de Assis'],
              language: ['por', 'eng'],
              isbn: ['9788535914849', '9780195103083'],
            },
          ])
        : google([]),
    )

    const res = await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })

    expect(res.body.candidates[0].isbn).toBeUndefined()
    expect(res.body.candidates[0].language).toBeUndefined()
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain('fields=')
  })

  it('keys on the ISBN only when the person typed one', async () => {
    fetchMock.mockReturnValue(google([volume(1)]))

    await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain('isbn%3A')
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain('isbn:')

    fetchMock.mockClear()
    await search({ title: 'Dom Casmurro', author: 'Machado de Assis', isbn: '978-85-0000-000-1' })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('isbn:9788500000001')
  })

  it('falls back to Open Library when Google has nothing', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('openlibrary')
        ? openLibrary([
            {
              key: '/works/OL1W',
              title: 'Dom Casmurro',
              author_name: ['Machado de Assis'],
              language: ['por'],
            },
          ])
        : google([]),
    )

    const res = await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })

    expect(res.body.source).toBe('open_library')
    expect(res.body.candidates[0]).toMatchObject({ volume_id: '/works/OL1W', language: 'por' })
  })

  it('says nothing was found when both sources answer with nothing', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('openlibrary') ? openLibrary([]) : google([]),
    )

    const res = await search({ title: 'Livro Inexistente', author: 'Ninguém' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ source: null, candidates: [] })
  })

  it('tells a search that did not answer apart from one that found nothing', async () => {
    fetchMock.mockImplementation(() => json({}, 503))

    const res = await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })

    expect(res.status).toBe(503)
  })

  it('takes whoever may add or edit books, and nobody else', async () => {
    fetchMock.mockReturnValue(google([volume(1)]))
    vi.mocked(Permission.findOne).mockResolvedValue({ actions: ['update'] })
    expect((await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })).status).toBe(200)

    vi.mocked(Permission.findOne).mockResolvedValue({ actions: ['read'] })
    expect((await search({ title: 'Dom Casmurro', author: 'Machado de Assis' })).status).toBe(403)
  })

  it('needs the title and the author', async () => {
    const res = await search({ title: 'Dom Casmurro' })

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
