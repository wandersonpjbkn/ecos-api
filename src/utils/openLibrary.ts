/**
 * Utilitário de enriquecimento via Open Library API.
 *
 * Estratégia de busca (ordem de prioridade):
 *  1. ISBN
 *  2. Título + autor
 *
 * Guidelines Open Library:
 *  - Enviamos User-Agent identificável em todas as requests.
 */

type OpenLibraryStrategy = 'openlibrary_isbn' | 'openlibrary_title_author'

export interface OpenLibraryResult {
  google_books_id: string
  cover_url?: string
  synopsis?: string
  publisher?: string
  isbn?: string
  page_count?: number
  published_year?: number
  strategy: OpenLibraryStrategy
}

interface OpenLibraryDoc {
  key?: string
  cover_i?: number
  isbn?: string[]
  first_sentence?: string | { value?: string }[]
  number_of_pages_median?: number
  first_publish_year?: number
  edition_key?: string[]
  publisher?: string[]
}

interface OpenLibrarySearchResponse {
  numFound: number
  docs?: OpenLibraryDoc[]
}

const API_BASE = 'https://openlibrary.org/search.json'
const COVER_BASE = 'https://covers.openlibrary.org/b'
const OPEN_LIBRARY_USER_AGENT = `${process.env.OPEN_LIBRARY_AGENT_LIB} (${process.env.OPEN_LIBRARY_AGENT_USER})`

const fetchDoc = async (url: string): Promise<OpenLibraryDoc | null> => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': OPEN_LIBRARY_USER_AGENT,
    },
  })

  if (!res.ok) return null

  const data = (await res.json()) as OpenLibrarySearchResponse
  return data.numFound && data.docs?.length ? (data.docs[0] ?? null) : null
}

const toSynopsis = (firstSentence?: OpenLibraryDoc['first_sentence']): string | undefined => {
  if (!firstSentence) return undefined
  if (typeof firstSentence === 'string') return firstSentence

  const first = firstSentence[0]
  return first?.value
}

const extractResult = (doc: OpenLibraryDoc, strategy: OpenLibraryStrategy): OpenLibraryResult => {
  const isbn = doc.isbn?.[0]
  const openLibraryId = doc.edition_key?.[0] ?? doc.key ?? 'openlibrary:unknown'

  const cover_url = isbn
    ? `${COVER_BASE}/isbn/${isbn}-L.jpg`
    : doc.cover_i
      ? `${COVER_BASE}/id/${doc.cover_i}-L.jpg`
      : undefined

  return {
    google_books_id: `openlibrary:${openLibraryId}`,
    cover_url,
    synopsis: toSynopsis(doc.first_sentence),
    publisher: doc.publisher?.[0],
    isbn,
    page_count: doc.number_of_pages_median,
    published_year: doc.first_publish_year,
    strategy,
  }
}

export const fetchOpenLibrary = async (
  titulo: string,
  autor: string,
  isbn?: string,
): Promise<OpenLibraryResult | null> => {
  if (isbn) {
    const cleanIsbn = isbn.replace(/[-\s]/g, '')

    try {
      const doc = await fetchDoc(`${API_BASE}?isbn=${encodeURIComponent(cleanIsbn)}&limit=1`)
      if (doc) {
        console.log(`[openLibrary] ✅ ISBN match: "${titulo}"`)
        return extractResult(doc, 'openlibrary_isbn')
      }
    } catch (err) {
      console.warn(`[openLibrary] Falha na busca por ISBN "${isbn}":`, err)
    }
  }

  try {
    const query = `${API_BASE}?title=${encodeURIComponent(titulo)}&author=${encodeURIComponent(autor)}&limit=1`
    const doc = await fetchDoc(query)
    if (doc) {
      console.log(`[openLibrary] ✅ título+autor match: "${titulo}"`)
      return extractResult(doc, 'openlibrary_title_author')
    }
  } catch (err) {
    console.warn(`[openLibrary] Falha na busca por título+autor "${titulo}":`, err)
  }

  console.log(`[openLibrary] ⏭️  Sem resultado para "${titulo}" — ${autor}`)
  return null
}
