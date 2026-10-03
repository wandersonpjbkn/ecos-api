import type { BookCandidate, CandidateSearch } from '@/utils/bookCandidate.js'

type OpenLibraryStrategy = 'openlibrary_isbn' | 'openlibrary_title_author'

interface OpenLibraryDoc {
  key?: string
  title?: string
  author_name?: string[]
  language?: string[]
  cover_i?: number
  isbn?: string[]
  first_sentence?: string | { value?: string }[]
  number_of_pages_median?: number
  first_publish_year?: number
  publisher?: string[]
}

interface OpenLibrarySearchResponse {
  numFound: number
  docs?: OpenLibraryDoc[]
}

const API_BASE = 'https://openlibrary.org/search.json'
const FIELDS =
  'key,title,author_name,language,cover_i,isbn,first_sentence,number_of_pages_median,first_publish_year,publisher'
const COVER_BASE = 'https://covers.openlibrary.org/b'
const OPEN_LIBRARY_USER_AGENT = `${process.env.OPEN_LIBRARY_AGENT_LIB} (${process.env.OPEN_LIBRARY_AGENT_USER})`

const fetchDocs = async (url: string): Promise<OpenLibraryDoc[]> => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': OPEN_LIBRARY_USER_AGENT,
    },
  })

  if (!res.ok) throw new Error(`Open Library ${res.status}`)

  const data = (await res.json()) as OpenLibrarySearchResponse
  return data.numFound && data.docs?.length ? data.docs : []
}

const toSynopsis = (firstSentence?: OpenLibraryDoc['first_sentence']): string | undefined => {
  if (!firstSentence) return undefined
  if (typeof firstSentence === 'string') return firstSentence

  const first = firstSentence[0]
  return first?.value
}

const coverUrlOf = (isbn: string | undefined, coverId: number | undefined): string | undefined => {
  if (isbn) return `${COVER_BASE}/isbn/${isbn}-L.jpg`
  if (coverId) return `${COVER_BASE}/id/${coverId}-L.jpg`
  return undefined
}

const onlyOne = (values?: string[]) => (values?.length === 1 ? values[0] : undefined)

const toCandidate = (doc: OpenLibraryDoc): BookCandidate => {
  const isbn = onlyOne(doc.isbn)

  return {
    volume_id: doc.key ?? `openlibrary:${isbn ?? doc.title ?? ''}`,
    title: doc.title,
    authors: doc.author_name ?? [],
    cover_url: coverUrlOf(isbn, doc.cover_i),
    synopsis: toSynopsis(doc.first_sentence),
    publisher: doc.publisher?.[0],
    isbn,
    page_count: doc.number_of_pages_median,
    published_year: doc.first_publish_year,
    language: onlyOne(doc.language),
  }
}

export const searchOpenLibrary = async (
  title: string,
  author: string,
  isbn: string | undefined,
  limit: number,
): Promise<CandidateSearch<OpenLibraryStrategy>> => {
  const strategies: Array<[OpenLibraryStrategy, string]> = [
    ...(isbn
      ? [
          [
            'openlibrary_isbn',
            `${API_BASE}?isbn=${encodeURIComponent(isbn.replace(/[-\s]/g, ''))}&limit=${limit}&fields=${FIELDS}`,
          ] as [OpenLibraryStrategy, string],
        ]
      : []),
    [
      'openlibrary_title_author',
      `${API_BASE}?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=${limit}&fields=${FIELDS}`,
    ],
  ]

  let answered = false
  for (const [strategy, url] of strategies) {
    try {
      const docs = await fetchDocs(url)
      answered = true
      if (docs.length) {
        console.log(`[openLibrary] ✅ ${strategy} match: "${title}"`)
        return { strategy, candidates: docs.map(toCandidate), failed: false }
      }
    } catch (err) {
      console.warn(`[openLibrary] Falha na busca (${strategy}) "${title}":`, err)
    }
  }

  console.log(`[openLibrary] ⏭️  Sem resultado para "${title}" — ${author}`)
  return { strategy: null, candidates: [], failed: !answered }
}
