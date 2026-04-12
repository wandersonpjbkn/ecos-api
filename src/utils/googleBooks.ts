/**
 * Utilitário de enriquecimento via Google Books API.
 *
 * Estratégia de busca (ordem de prioridade):
 *  1. ISBN — se disponível no documento, busca por isbn:XXXXXX (resultado mais preciso)
 *  2. Título + autor — fallback quando não há ISBN
 *  3. Título + autor sem restrição de idioma — último fallback
 *
 * A chave de API é lida de process.env.GOOGLE_BOOKS_API_KEY.
 * Se não definida, funciona sem chave (limite ~1.000 req/dia).
 */

type GoogleBooksStrategy = 'isbn' | 'title_author_pt' | 'title_author'

interface GoogleBooksResult {
  google_books_id: string
  cover_url?: string
  synopsis?: string
  isbn?: string
  page_count?: number
  published_year?: number
  strategy: GoogleBooksStrategy
}

interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title?: string
    description?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    pageCount?: number
    publishedDate?: string
  }
}

interface GoogleBooksResponse {
  totalItems: number
  items?: GoogleBooksVolume[]
}

const API_BASE = 'https://www.googleapis.com/books/v1/volumes'

const buildUrl = (query: string, keyParam: string): string =>
  `${API_BASE}?q=${query}&maxResults=1${keyParam}`

const fetchVolume = async (url: string): Promise<GoogleBooksVolume | null> => {
  const res = await fetch(url)
  if (!res.ok) return null

  const data = (await res.json()) as GoogleBooksResponse
  return data.totalItems && data.items?.length ? (data.items[0] ?? null) : null
}

/**
 * Busca um livro na Google Books API.
 * Aceita ISBN opcional — quando presente, tem prioridade sobre título+autor.
 * Retorna null se não encontrar resultado válido.
 */
export const fetchGoogleBooks = async (
  titulo: string,
  autor: string,
  isbn?: string,
): Promise<GoogleBooksResult | null> => {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  const keyParam = apiKey ? `&key=${apiKey}` : ''

  // ── Estratégia 1: ISBN ─────────────────────────────────────────
  if (isbn) {
    const cleanIsbn = isbn.replace(/[-\s]/g, '')
    const url = buildUrl(`isbn:${cleanIsbn}`, keyParam)

    try {
      const volume = await fetchVolume(url)
      if (volume) {
        console.log(`[googleBooks] ✅ ISBN match: "${titulo}"`)
        return extractResult(volume, 'isbn')
      }
    } catch (err) {
      console.warn(`[googleBooks] Falha na busca por ISBN "${isbn}":`, err)
    }
  }

  // ── Estratégia 2: título + autor (com restrição de idioma pt) ──
  const titleAuthorQuery = encodeURIComponent(`intitle:${titulo} inauthor:${autor}`)

  try {
    const url = buildUrl(`${titleAuthorQuery}&langRestrict=pt`, keyParam)
    const volume = await fetchVolume(url)
    if (volume) {
      console.log(`[googleBooks] ✅ título+autor (pt) match: "${titulo}"`)
      return extractResult(volume, 'title_author_pt')
    }
  } catch (err) {
    console.warn(`[googleBooks] Falha na busca por título+autor (pt) "${titulo}":`, err)
  }

  // ── Estratégia 3: título + autor sem restrição de idioma ───────
  try {
    const url = buildUrl(titleAuthorQuery, keyParam)
    const volume = await fetchVolume(url)
    if (volume) {
      console.log(`[googleBooks] ✅ título+autor (sem lang) match: "${titulo}"`)
      return extractResult(volume, 'title_author')
    }
  } catch (err) {
    console.warn(`[googleBooks] Falha na busca sem restrição "${titulo}":`, err)
  }

  console.log(`[googleBooks] ⏭️  Sem resultado para "${titulo}" — ${autor}`)
  return null
}

const extractResult = (volume: GoogleBooksVolume, strategy: GoogleBooksStrategy): GoogleBooksResult => {
  const info = volume.volumeInfo

  // Prefere thumbnail sobre smallThumbnail e força HTTPS
  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  const cover_url = rawCover?.replace(/^http:\/\//, 'https://') ?? undefined

  // Extrai ISBN-13 preferencialmente, senão ISBN-10
  const isbn13 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier
  const isbn10 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier
  const isbn = isbn13 ?? isbn10 ?? undefined

  const published_year = info.publishedDate
    ? parseInt(info.publishedDate.slice(0, 4), 10) || undefined
    : undefined

  return {
    google_books_id: volume.id,
    cover_url,
    synopsis: info.description ?? undefined,
    isbn,
    page_count: info.pageCount ?? undefined,
    published_year,
    strategy,
  }
}
