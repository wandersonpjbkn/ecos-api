interface SupabaseTokenResponse {
  access_token: string
  refresh_token: string
}

const SUPABASE_HEALTH_TIMEOUT_MS = 5_000

export const checkSupabaseAuth = async (): Promise<void> => {
  const url = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const email = process.env.SUPABASE_KEEPALIVE_EMAIL
  const password = process.env.SUPABASE_KEEPALIVE_PASSWORD

  if (!url || !publishableKey || !email || !password) {
    throw new Error('Supabase keep-alive credentials not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_HEALTH_TIMEOUT_MS)

  const baseHeaders = {
    apikey: publishableKey,
    'Content-Type': 'application/json',
  }

  try {
    const signInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    })
    if (!signInRes.ok) {
      throw new Error(`Supabase sign-in responded with ${signInRes.status}`)
    }
    const session = (await signInRes.json()) as SupabaseTokenResponse

    const refreshRes = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      signal: controller.signal,
    })
    if (!refreshRes.ok) {
      throw new Error(`Supabase refresh responded with ${refreshRes.status}`)
    }
    const refreshed = (await refreshRes.json()) as SupabaseTokenResponse

    const logoutRes = await fetch(`${url}/auth/v1/logout`, {
      method: 'POST',
      headers: { ...baseHeaders, Authorization: `Bearer ${refreshed.access_token}` },
      signal: controller.signal,
    })
    if (!logoutRes.ok) {
      throw new Error(`Supabase logout responded with ${logoutRes.status}`)
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
