export type EntryFormat = 'LP' | 'EP' | 'Single' | 'Live' | 'Compilation' | 'Other'

export interface ExternalLink {
  label: string
  url: string
}

export interface Entry {
  id: string
  selector: string       // crew member who picked this album
  artist: string
  title: string
  year: number
  format: EntryFormat
  genre_tags: string[]
  badge_emoji: string
  about_band: string
  about_album: string
  fun_facts: string[]
  tracklist: string[]
  external_link?: ExternalLink
}

export type SessionPhase = 'selection' | 'listening' | 'done'

export interface Session {
  id: string        // for monthly sessions, this is the month string YYYY-MM
  month: string     // YYYY-MM
  title: string
  date: string      // YYYY-MM-DD (first day of month)
  entries: Entry[]
  phase: SessionPhase
  locked: boolean   // true after meeting is ended
  overallRatings?: Record<string, number> // entryId → avg combined rating
  createdAt: string
  updatedAt: string
}

// Per-save snapshot for history
export interface NoteRevision {
  albumNotes: string
  trackNotes: Record<string, string>  // track name → note
  rating: number                      // 1–5, 0 = not rated
  savedAt: string
}

export interface UserEntryNotes {
  entryId: string
  current: NoteRevision
  history: NoteRevision[]             // previous saves, newest first (max 10)
}

// What gets stored in DynamoDB per user per session
export interface UserSessionNotes {
  userId: string
  userName: string
  entries: Record<string, UserEntryNotes>  // entryId → notes
  updatedAt: string
}

export interface SessionNotes {
  sessionId: string
  users: UserSessionNotes[]
}

export interface LookupRequest {
  artist: string
  album: string
}

export interface LookupResult {
  about_band: string
  about_album: string
  genre_tags: string[]
  year: number
  format: EntryFormat
  fun_facts: string[]
  tracklist: string[]
  external_link?: { label: string; url: string }
}

export interface SummaryRequest {
  session: Session
  allNotes: UserSessionNotes[]
}

export interface SummaryResponse {
  summary: string
}
