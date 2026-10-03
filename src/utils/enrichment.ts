import type { BookCandidate } from '@/utils/bookCandidate.js'
import { fetchGoogleBooks, searchGoogleBooks } from '@/utils/googleBooks.js'
import { fetchOpenLibrary, searchOpenLibrary } from '@/utils/openLibrary.js'

export interface EnrichmentPayload {
  data: Awaited<ReturnType<typeof fetchGoogleBooks>> | Awaited<ReturnType<typeof fetchOpenLibrary>>
  source: EnrichmentSource
}

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
])

// null, undefined and '' are the same empty value: comparing them raw writes history for edits nobody made.
export const differs = (next: unknown, current: unknown) =>
  String(next ?? '') !== String(current ?? '')

// Compared with the stored book, not just present: an edit form sends back every field it loaded.
export const hasEnrichmentEdit = (payload: Record<string, unknown>, current: object): boolean =>
  Object.keys(payload).some(
    (k) => ENRICHMENT_FIELDS.has(k) && differs(payload[k], (current as Record<string, unknown>)[k]),
  )

export const changesCover = (payload: Record<string, unknown>, current: object): boolean =>
  payload.cover_url !== undefined &&
  differs(payload.cover_url, (current as Record<string, unknown>).cover_url)

export const getCoverSourceFromEnrichment = (source: EnrichmentSource): 'google' | 'openlibrary' =>
  source === 'google_books' ? 'google' : 'openlibrary'

export const fetchEnrichmentPayload = async (
  title: string,
  author: string,
  isbn?: string,
): Promise<EnrichmentPayload | null> => {
  const googleData = await fetchGoogleBooks(title, author, isbn)
  if (googleData) {
    return { data: googleData, source: 'google_books' }
  }

  const openLibraryData = await fetchOpenLibrary(title, author, isbn)
  if (openLibraryData) {
    return { data: openLibraryData, source: 'open_library' }
  }

  return null
}

export const SEARCH_LIMIT = 5

/** Up to five books for the form to choose from: Google first, Open Library when Google has none or does not answer. */
export const searchCandidates = async (
  title: string,
  author: string,
  isbn?: string,
): Promise<{ source: EnrichmentSource | null; candidates: BookCandidate[]; failed: boolean }> => {
  const google = await searchGoogleBooks(title, author, isbn, SEARCH_LIMIT)
  if (google.candidates.length)
    return { source: 'google_books', candidates: google.candidates, failed: false }

  const openLibrary = await searchOpenLibrary(title, author, isbn, SEARCH_LIMIT)
  if (openLibrary.candidates.length) {
    return { source: 'open_library', candidates: openLibrary.candidates, failed: false }
  }
  return { source: null, candidates: [], failed: google.failed && openLibrary.failed }
}

/** The ISBN a search may key on: only one a person typed; one copied from an earlier search may be another edition. */
export const confirmedIsbn = (book: { isbn?: string | null; isbn_source?: string | null }) =>
  book.isbn_source === 'person' && book.isbn ? book.isbn : undefined

/** The author the search uses: the first one, the one a list shows; null when missing or since removed. */
export const mainAuthorName = (authors: unknown): string | null => {
  const first: unknown = Array.isArray(authors) ? authors[0] : null
  return first && typeof first === 'object' && 'nome' in first ? String(first.nome) : null
}
