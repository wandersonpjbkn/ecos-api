const SUPABASE_HEALTH_TIMEOUT_MS = 5_000

export const checkSupabaseAuth = async (): Promise<void> => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const email = process.env.SUPABASE_KEEPALIVE_EMAIL
  const password = process.env.SUPABASE_KEEPALIVE_PASSWORD

  if (!url || !anonKey || !email || !password) {
    throw new Error('Supabase keep-alive credentials not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_HEALTH_TIMEOUT_MS)

  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Supabase auth responded with status ${res.status}`)
  } finally {
    clearTimeout(timeoutId)
  }
}
