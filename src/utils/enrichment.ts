import { fetchGoogleBooks } from '@/utils/googleBooks.js'
import { fetchOpenLibrary } from '@/utils/openLibrary.js'

export type EnrichmentSource = 'google_books' | 'open_library'

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
