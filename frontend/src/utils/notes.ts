import type { NoteRevision } from '../types'

// DynamoDB stores a note flat: { albumNotes, trackNotes, rating, ... }.
// listeningStore.getUserSessionNotes wraps the same shape as { current: ... }.
// This resolves either representation to a plain NoteRevision.
export function resolveNoteRevision(raw: unknown): NoteRevision | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if ('current' in r && r.current && typeof r.current === 'object') return r.current as NoteRevision
  if ('albumNotes' in r || 'rating' in r || 'trackNotes' in r) return r as unknown as NoteRevision
  return null
}

// A revision counts as empty only if it has no content at all — including
// pickerNote and trackReactions, which are real stored content and not just
// album/track notes + rating.
export function isEmptyRevision(rev: NoteRevision | null): boolean {
  if (!rev) return true
  const hasAlbumNotes = !!rev.albumNotes?.trim()
  const hasTrackNotes = Object.values(rev.trackNotes ?? {}).some((v) => v?.trim())
  const hasRating = (rev.rating ?? 0) > 0
  const hasPickerNote = !!rev.pickerNote?.trim()
  const hasReactions = Object.keys(rev.trackReactions ?? {}).length > 0
  return !hasAlbumNotes && !hasTrackNotes && !hasRating && !hasPickerNote && !hasReactions
}
