// Allowlist of what anyone, signed in or not, sees of a book; who added or edited it stays on the server.
const PUBLIC_FIELDS = [
  '_id',
  'titulo',
  'authors',
  'categoria',
  'midia',
  'subgeneros',
  'quem_nome',
  'quem_user_id',
  'porque',
  'isbn',
  'publisher',
  'cover_url',
  'synopsis',
  'google_books_id',
  'page_count',
  'published_year',
  'added_at',
] as const

export const publicBook = (book: Record<string, unknown>) =>
  Object.fromEntries(
    PUBLIC_FIELDS.filter((field) => field in book).map((field) => [field, book[field]]),
  )
