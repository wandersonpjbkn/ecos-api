import type { BookCandidate } from '@/utils/bookCandidate.js'
import { searchGoogleBooks } from '@/utils/googleBooks.js'
import { searchOpenLibrary } from '@/utils/openLibrary.js'

export type EnrichmentSource = 'google_books' | 'open_library'

// null, undefined and '' are the same empty value: comparing them raw writes history for edits nobody made.
export const differs = (next: unknown, current: unknown) =>
  String(next ?? '') !== String(current ?? '')

export const changesCover = (payload: Record<string, unknown>, current: object): boolean =>
  payload.cover_url !== undefined &&
  differs(payload.cover_url, (current as Record<string, unknown>).cover_url)

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
