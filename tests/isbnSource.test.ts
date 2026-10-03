import { Types } from 'mongoose'
import { describe, expect, it } from 'vitest'

import { Book } from '@/models/Book.js'
import { markBookEdit, PANEL_TRACKED, recordBookEdit } from '@/utils/bookEdit.js'

const stored = (fields: Record<string, unknown> = {}) =>
  new Book({
    titulo: 'Dom Casmurro',
    authors: [new Types.ObjectId()],
    categoria: new Types.ObjectId(),
    midia: new Types.ObjectId(),
    added_by: new Types.ObjectId(),
    ...fields,
  })

// What a PATCH does: record, assign, mark.
const edit = (book: ReturnType<typeof stored>, payload: Record<string, unknown>) => {
  const marks = recordBookEdit(book, payload, new Types.ObjectId(), PANEL_TRACKED)
  Object.assign(book, payload)
  markBookEdit(book, payload, marks)
  return book
}

describe('where an ISBN came from', () => {
  it('counts an ISBN typed in the form as the person’s', () => {
    expect(edit(stored(), { isbn: '9788535914849' }).isbn_source).toBe('person')
  })

  it('counts an ISBN the form took from its search as the search’s', () => {
    expect(edit(stored(), { isbn: '9788535914849', isbn_source: 'search' }).isbn_source).toBe(
      'search',
    )
  })

  it('keeps a typed ISBN confirmed when a search brings the same number', () => {
    const book = stored({ isbn: '9788535914849', isbn_source: 'person' })

    expect(edit(book, { isbn: '9788535914849', isbn_source: 'search' }).isbn_source).toBe('person')
  })

  it('drops the origin with the ISBN', () => {
    const book = stored({ isbn: '9788535914849', isbn_source: 'search' })

    expect(edit(book, { isbn: null }).isbn_source).toBeUndefined()
  })
})

describe('where a cover came from', () => {
  it('credits the source the form says, when the cover came from its search', () => {
    expect(
      edit(stored(), { cover_url: 'https://books.google.com/x', cover_source: 'google' })
        .cover_source,
    ).toBe('google')
  })

  it('counts any other new cover as typed by hand', () => {
    expect(edit(stored(), { cover_url: 'https://exemplo.com/capa.jpg' }).cover_source).toBe(
      'manual',
    )
  })
})
