import { fetchGoogleBooks } from '@/utils/googleBooks.js'
import { fetchOpenLibrary } from '@/utils/openLibrary.js'

export type EnrichmentSource = 'google_books' | 'open_library'

// A person changed one of these by hand: the automatic search then leaves the book alone (manually_edited_at).
const ENRICHMENT_FIELDS = new Set([
  'cover_url',
  'cover_source',
  'synopsis',
  'publisher',
  'isbn',
  'page_count',
  'published_year',
  'google_books_id',
])

// null, undefined and '' are the same empty value: comparing them raw writes history for edits nobody made.
export const differs = (next: unknown, current: unknown) => String(next ?? '') !== String(current ?? '')

// Compared with the stored book, not just present: an edit form sends back every field it loaded.
export const hasEnrichmentEdit = (payload: Record<string, unknown>, current: object): boolean =>
  Object.keys(payload).some(
    (k) => ENRICHMENT_FIELDS.has(k) && differs(payload[k], (current as Record<string, unknown>)[k]),
  )

export const changesCover = (payload: Record<string, unknown>, current: object): boolean =>
  payload.cover_url !== undefined &&
  differs(payload.cover_url, (current as Record<string, unknown>).cover_url)

export interface EnrichmentPayload {
  data: Awaited<ReturnType<typeof fetchGoogleBooks>> | Awaited<ReturnType<typeof fetchOpenLibrary>>
  source: EnrichmentSource
}

export const getCoverSourceFromEnrichment = (source: EnrichmentSource): 'google' | 'openlibrary' =>
  source === 'google_books' ? 'google' : 'openlibrary'

export const fetchEnrichmentPayload = async (
  titulo: string,
  autor: string,
  isbn?: string,
): Promise<EnrichmentPayload | null> => {
  const googleData = await fetchGoogleBooks(titulo, autor, isbn)
  if (googleData) {
    return { data: googleData, source: 'google_books' }
  }

  const openLibraryData = await fetchOpenLibrary(titulo, autor, isbn)
  if (openLibraryData) {
    return { data: openLibraryData, source: 'open_library' }
  }

  return null
}
