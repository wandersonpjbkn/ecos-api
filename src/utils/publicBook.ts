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
  'page_count',
  'published_year',
  'added_at',
] as const

export const publicBook = (book: object) =>
  Object.fromEntries(
    PUBLIC_FIELDS.filter((field) => field in book).map((field) => [
      field,
      (book as Record<string, unknown>)[field],
    ]),
  )
