/** One book a search found, as the form's search view shows it; nothing here is saved until the form is. */
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
  // As the source gives it: two letters from Google ("pt"), three from Open Library ("por").
  language?: string
}

export interface CandidateSearch<Strategy extends string> {
  strategy: Strategy | null
  candidates: BookCandidate[]
  failed: boolean
}
