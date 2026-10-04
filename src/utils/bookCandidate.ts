export interface BookCandidate {
  volume_id: string
  title?: string
  authors: string[]
  cover_url?: string
  synopsis?: string
  publisher?: string
  isbn?: string
  page_count?: number
  published_year?: number
  language?: string
}

export interface CandidateSearch<Strategy extends string> {
  strategy: Strategy | null
  candidates: BookCandidate[]
  failed: boolean
}
