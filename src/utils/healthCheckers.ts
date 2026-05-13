const SUPABASE_HEALTH_TIMEOUT_MS = 5_000

interface SupabaseTokenResponse {
  access_token: string
  refresh_token: string
}

/**
 * Simulates a real user session against Supabase Auth using a dedicated
 * keep-alive user. The full flow (sign in → refresh → logout) registers
 * meaningful activity on auth.sessions, auth.refresh_tokens and auth.users
 * to prevent the free tier 7-day inactivity auto-pause, and surfaces three
 * distinct events in the Supabase auth logs.
 */
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

  const baseHeaders = {
    apikey: anonKey,
    'Content-Type': 'application/json',
  }

  try {
    // Step 1: password sign in — inserts session + refresh token rows
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

    // Step 2: token refresh — mirrors the most common real-user activity
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

    // Step 3: logout — removes the session row, keeps auth tables tidy
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
