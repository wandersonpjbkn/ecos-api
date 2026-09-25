import type { Types } from 'mongoose'

import { User } from '@/models/User.js'

// The CSV migration marks every book it brought from the WhatsApp conversation with this user.
const MIGRATION_UID = 'system-migration'

export type BookOrigin = 'conversa' | 'site'

let migrationUserId: string | undefined

// Cached only once found: a server started before the migration ran must not call every book "site" forever.
const getMigrationUserId = async (): Promise<string | undefined> => {
  if (!migrationUserId) {
    const user = await User.findOne({ supabase_uid: MIGRATION_UID }).select('_id').lean()
    if (user) migrationUserId = String(user._id)
  }
  return migrationUserId
}

type WithAddedBy = { added_by?: Types.ObjectId | { _id: Types.ObjectId } | null }

/** Adds `origem` so the client can say where a book came from without knowing internal users. */
export const withOrigin = async <T extends WithAddedBy>(
  books: T[],
): Promise<(T & { origem: BookOrigin })[]> => {
  const migrationId = await getMigrationUserId()
  return books.map((book) => {
    const addedBy = book.added_by && '_id' in book.added_by ? book.added_by._id : book.added_by
    return { ...book, origem: migrationId && String(addedBy) === migrationId ? 'conversa' : 'site' }
  })
}
