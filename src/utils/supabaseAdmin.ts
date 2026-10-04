const SUPABASE_ADMIN_TIMEOUT_MS = 5_000
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

export const deleteSupabaseAccount = async (uid: string): Promise<void> => {
  const res = await adminRequest(uid, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new SupabaseAdminError(res.status)
}
