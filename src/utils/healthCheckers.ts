const SUPABASE_HEALTH_TIMEOUT_MS = 5_000

export const checkSupabaseAuth = async (): Promise<void> => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_HEALTH_TIMEOUT_MS)

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Supabase auth responded with status ${res.status}`)
  } finally {
    clearTimeout(timeoutId)
  }
}
