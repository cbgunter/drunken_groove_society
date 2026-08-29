import type { Session, SessionNotes, SummaryRequest, SummaryResponse, LookupRequest, LookupResult, TrackReaction } from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

interface AuthHooks {
  getValidIdToken: () => Promise<string | null>
  forceRefresh: () => Promise<string | null>
  signOut: () => void
}

// Registered by authStore once it's created. Kept as a plain module-level
// registration (rather than a static import of authStore here) because
// several stores import `api`, and authStore itself needs to reset those
// stores on sign-in — a static import cycle either way.
let authHooks: AuthHooks | null = null
export function registerAuthHooks(hooks: AuthHooks) {
  authHooks = hooks
}

async function request<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
  const token = await authHooks?.getValidIdToken()

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })

  if ((res.status === 401 || res.status === 403) && allowRetry) {
    const fresh = await authHooks?.forceRefresh()
    if (fresh) return request<T>(path, init, false)
    authHooks?.signOut()
    throw new Error('Your session expired — sign in again.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getSession: (id: string) => request<Session>(`/sessions/${id}`),

  putSession: (session: Session) =>
    request<{ id: string }>(`/sessions/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify(session),
    }),

  getNotes: (sessionId: string) =>
    request<SessionNotes>(`/sessions/${sessionId}/notes`),

  // Identity comes from the Authorization header (verified server-side) —
  // no userId/userName in the body.
  putNotes: (
    sessionId: string,
    entryId: string,
    notes: { albumNotes: string; trackNotes: Record<string, string>; rating: number; pickerNote?: string; trackReactions?: Record<string, TrackReaction> },
  ) =>
    request<{ ok: boolean }>(`/sessions/${sessionId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ entryId, notes }),
    }),

  lookupAlbum: (payload: LookupRequest) =>
    request<LookupResult>('/lookup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateSummary: (payload: SummaryRequest) =>
    request<SummaryResponse>('/summary', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendSummary: (payload: { summary: string; sessionMonth: string }) =>
    request<{ sent: boolean }>('/send-summary', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
