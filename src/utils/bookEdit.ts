import type { HydratedDocument, Types } from 'mongoose'

import type { IBook } from '@/models/Book.js'
import { changesCover, differs, hasEnrichmentEdit } from '@/utils/enrichment.js'

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
  'google_books_id',
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
    now,
    enrichmentEdited: hasEnrichmentEdit(payload, stored),
    coverChanged: changesCover(payload, stored),
  }
}

/** A hand-made correction is not overwritten by the automatic search; an emptied cover has no source to credit. */
export const markBookEdit = (
  book: HydratedDocument<IBook>,
  payload: Record<string, unknown>,
  { now, enrichmentEdited, coverChanged }: ReturnType<typeof recordBookEdit>,
) => {
  if (enrichmentEdited) book.manually_edited_at = now
  if (coverChanged) book.cover_source = payload.cover_url ? 'manual' : undefined
}

const EMPTY_WHEN_NULL: readonly string[] = ['page_count', 'published_year']

/** The owner's edit lands field by field: only what came in the body changes, and a cleared number is unset. */
export const applyOwnerFields = (book: HydratedDocument<IBook>, body: Record<string, unknown>) => {
  for (const field of OWNER_TRACKED) {
    const value = body[field]
    if (value === undefined) continue
    book.set(field, EMPTY_WHEN_NULL.includes(field) ? (value ?? undefined) : value)
  }
}
