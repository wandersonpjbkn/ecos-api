import type { HydratedDocument, Types } from 'mongoose'

import type { IBook } from '@/models/Book.js'
import { changesCover, differs } from '@/utils/enrichment.js'

type Tracked = (typeof PANEL_TRACKED)[number] | (typeof OWNER_TRACKED)[number]

export const PANEL_TRACKED = [
  'titulo',
  'authors',
  'categoria',
  'midia',
  'subgeneros',
  'quem_nome',
  'quem_user_id',
  'porque',
  'isbn',
  'cover_url',
  'cover_source',
  'synopsis',
  'publisher',
  'page_count',
  'published_year',
] as const

export const OWNER_TRACKED = [
  'titulo',
  'authors',
  'categoria',
  'midia',
  'subgeneros',
  'porque',
  'synopsis',
  'isbn',
  'cover_url',
  'publisher',
  'page_count',
  'published_year',
] as const

/** Logs each changed field; call it before the new values land, and pass the result to `markBookEdit` after. */
export const recordBookEdit = (
  book: HydratedDocument<IBook>,
  payload: Record<string, unknown>,
  userId: Types.ObjectId,
  fields: readonly Tracked[],
) => {
  const now = new Date()
  for (const field of fields) {
    if (payload[field] !== undefined && differs(payload[field], book[field])) {
      book.edit_history.push({
        field,
        previous_value: String(book[field] ?? ''),
        edited_at: now,
        edited_by: userId,
      })
    }
  }
  const stored = book.toObject()
  return {
    coverChanged: changesCover(payload, stored),
    isbnChanged: payload.isbn !== undefined && differs(payload.isbn, stored.isbn),
    isbnSource: stored.isbn_source,
  }
}

/** Where the cover and the ISBN came from; an emptied cover has no source to credit. */
export const markBookEdit = (
  book: HydratedDocument<IBook>,
  payload: Record<string, unknown>,
  { coverChanged, isbnChanged, isbnSource }: ReturnType<typeof recordBookEdit>,
) => {
  // The form says when the cover or the ISBN came from its search; anything else was typed by a person.
  if (coverChanged)
    book.cover_source = payload.cover_url ? (sourceOf(payload.cover_source) ?? 'manual') : undefined
  // The same ISBN keeps its origin: a search that finds the number a person typed does not unconfirm it.
  if (!isbnChanged) book.isbn_source = isbnSource
  else book.isbn_source = payload.isbn ? isbnSourceOf(payload) : undefined
}

const sourceOf = (value: unknown) =>
  value === 'google' || value === 'openlibrary' || value === 'manual' ? value : undefined

/** Where a new ISBN came from: the form's search when it says so, a person otherwise. */
export const isbnSourceOf = (payload: Record<string, unknown>): 'person' | 'search' =>
  payload.isbn_source === 'search' ? 'search' : 'person'

const EMPTY_WHEN_NULL: readonly string[] = ['page_count', 'published_year']

/** The owner's edit lands field by field: only what came in the body changes, and a cleared number is unset. */
export const applyOwnerFields = (book: HydratedDocument<IBook>, body: Record<string, unknown>) => {
  for (const field of OWNER_TRACKED) {
    const value = body[field]
    if (value === undefined) continue
    book.set(field, EMPTY_WHEN_NULL.includes(field) ? (value ?? undefined) : value)
  }
}
