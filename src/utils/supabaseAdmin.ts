// Supabase Auth admin, with the secret key: it bypasses every rule, so it never leaves the server.
const SUPABASE_ADMIN_TIMEOUT_MS = 5_000
// Supabase has no permanent ban: a century stands in for "until an admin lifts it".
const SUSPENDED_FOR = '876000h'

export class SupabaseAdminError extends Error {
  constructor(readonly status: number) {
    super(`Supabase admin responded with ${status}`)
  }
}

const adminRequest = async (uid: string, init: RequestInit = {}): Promise<Response> => {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) throw new Error('Supabase admin credentials not configured')

  return fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(uid)}`, {
    ...init,
    headers: { apikey: secretKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(SUPABASE_ADMIN_TIMEOUT_MS),
  })
}

/** Whether the Supabase account behind a token still exists: a valid token outlives a deleted account by up to 1 h. */
export const supabaseAccountExists = async (uid: string): Promise<boolean> => {
  const res = await adminRequest(uid)
  if (res.status === 404) return false
  if (!res.ok) throw new SupabaseAdminError(res.status)
  return true
}

export const setSupabaseSuspended = async (uid: string, suspended: boolean): Promise<void> => {
  const res = await adminRequest(uid, {
    method: 'PUT',
    body: JSON.stringify({ ban_duration: suspended ? SUSPENDED_FOR : 'none' }),
  })
  if (!res.ok) throw new SupabaseAdminError(res.status)
}

// Hard delete: the same e-mail can sign up again as a new Visitante. Already gone counts as done, so a retry is safe.
export const deleteSupabaseAccount = async (uid: string): Promise<void> => {
  const res = await adminRequest(uid, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new SupabaseAdminError(res.status)
}
