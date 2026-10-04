import type { BookCandidate, CandidateSearch } from '@/utils/bookCandidate.js'

type GoogleBooksStrategy = 'isbn' | 'title_author_pt' | 'title_author'

interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    language?: string
    pageCount?: number
    publishedDate?: string
    publisher?: string
  }
}

interface GoogleBooksResponse {
  totalItems: number
  items?: GoogleBooksVolume[]
}

const API_BASE = 'https://www.googleapis.com/books/v1/volumes'

const buildUrl = (query: string, keyParam: string, limit: number): string =>
  `${API_BASE}?q=${query}&maxResults=${limit}${keyParam}`

const fetchVolumes = async (url: string): Promise<GoogleBooksVolume[]> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google Books ${res.status}`)

  const data = (await res.json()) as GoogleBooksResponse
  return data.totalItems && data.items?.length ? data.items : []
}

const toCandidate = (volume: GoogleBooksVolume): BookCandidate => {
  const info = volume.volumeInfo

  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  const cover_url = rawCover?.replace(/^http:\/\//, 'https://') ?? undefined

  const isbn13 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier

  const published_year = info.publishedDate
    ? parseInt(info.publishedDate.slice(0, 4), 10) || undefined
    : undefined

  return {
    volume_id: volume.id,
    title: info.title,
    authors: info.authors ?? [],
    cover_url,
    synopsis: info.description ?? undefined,
    publisher: info.publisher ?? undefined,
    isbn: isbn13 ?? isbn10 ?? undefined,
    page_count: info.pageCount ?? undefined,
    published_year,
    language: info.language,
  }
}

export const searchGoogleBooks = async (
  title: string,
  author: string,
  isbn: string | undefined,
  limit: number,
): Promise<CandidateSearch<GoogleBooksStrategy>> => {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const keyParam = apiKey ? `&key=${apiKey}` : ''
  const titleAuthorQuery = encodeURIComponent(`${title} ${author}`)

  const strategies: Array<[GoogleBooksStrategy, string]> = [
    ...(isbn
      ? [['isbn', `isbn:${isbn.replace(/[-\s]/g, '')}`] as [GoogleBooksStrategy, string]]
      : []),
    ['title_author_pt', `${titleAuthorQuery}&langRestrict=pt`],
    ['title_author', titleAuthorQuery],
  ]

  let answered = false
  for (const [strategy, query] of strategies) {
    try {
      const volumes = await fetchVolumes(buildUrl(query, keyParam, limit))
      answered = true
      if (volumes.length) {
        console.log(`[googleBooks] ✅ ${strategy} match: "${title}"`)
        return { strategy, candidates: volumes.map(toCandidate), failed: false }
      }
    } catch (err) {
      console.warn('[googleBooks] Falha na busca (%s) "%s":', strategy, title, err)
    }
  }

  console.log(`[googleBooks] ⏭️  Sem resultado para "${title}" — ${author}`)
  return { strategy: null, candidates: [], failed: !answered }
}
