import type { Session, SessionNotes, SummaryRequest, SummaryResponse, LookupRequest, LookupResult } from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
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

  putNotes: (
    sessionId: string,
    userId: string,
    userName: string,
    entryId: string,
    notes: { albumNotes: string; trackNotes: Record<string, string>; rating: number },
  ) =>
    request<{ ok: boolean }>(`/sessions/${sessionId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ userId, userName, entryId, notes }),
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
}
