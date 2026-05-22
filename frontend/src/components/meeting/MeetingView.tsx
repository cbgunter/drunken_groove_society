import { useState } from 'react'
import type { Entry, NoteRevision, Session, UserSessionNotes } from '../../types'
import { useSessionStore } from '../../store/sessionStore'
import { useListeningStore } from '../../store/listeningStore'
import { useCalendarStore } from '../../store/calendarStore'
import { api } from '../../api/client'
import { renderMarkdown } from '../../utils/markdown'

interface Props {
  session: Session
  identity: { userId: string; userName: string }
  allNotes: UserSessionNotes[]
  onEndMeeting: (overallRatings: Record<string, number>) => void
}

// DynamoDB returns flat { albumNotes, trackNotes, rating }; local store wraps in { current: ... }
function resolveNoteRevision(raw: unknown): NoteRevision | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if ('current' in r && r.current && typeof r.current === 'object') return r.current as NoteRevision
  if ('albumNotes' in r || 'rating' in r || 'trackNotes' in r) return r as unknown as NoteRevision
  return null
}

function RatingBadge({ rating }: { rating: number }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span className="font-semibold" style={{ color: 'var(--accent)' }}>
      {'🎵'.repeat(rating)} {rating}/5
    </span>
  )
}

function UserNoteAccordion({
  userName,
  entryId,
  notes,
  tracklist,
}: {
  userName: string
  entryId: string
  notes: UserSessionNotes
  tracklist: string[]
}) {
  const [expanded, setExpanded] = useState(true)
  const rev = resolveNoteRevision(notes.entries[entryId])
  const hasContent = rev && (rev.albumNotes || rev.rating || Object.values(rev.trackNotes ?? {}).some(Boolean))

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <button
        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{userName || 'Unknown'}</span>
        </span>
        <RatingBadge rating={rev?.rating ?? 0} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {!hasContent ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No notes from {userName}.</p>
          ) : (
            <>
              {rev?.albumNotes && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {rev.albumNotes}
                </p>
              )}
              {tracklist.map((track) => {
                const note = rev?.trackNotes?.[track]
                if (!note) return null
                return (
                  <div key={track} className="text-xs">
                    <span className="font-semibold" style={{ color: 'var(--accent)' }}>{track}: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{note}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TrackByTrackView({ entry, allMerged }: { entry: Entry; allMerged: UserSessionNotes[] }) {
  if (!entry.tracklist.length) {
    return (
      <div className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        No tracklist available — switch to album notes view.
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {entry.tracklist.map((track, i) => {
        const userNotes = allMerged
          .map((u) => ({
            name: u.userName || u.userId.slice(0, 6),
            note: resolveNoteRevision(u.entries[entry.id])?.trackNotes?.[track],
          }))
          .filter((x) => x.note?.trim())

        return (
          <div key={i} className="px-3 py-2">
            <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              {i + 1}. {track}
            </p>
            {userNotes.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>No notes</p>
            ) : (
              <div className="space-y-0.5">
                {userNotes.map(({ name, note }) => (
                  <div key={name} className="flex gap-2 text-xs">
                    <span className="font-semibold flex-shrink-0" style={{ color: 'var(--accent)' }}>
                      {name}:
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MeetingView({ session, identity, allNotes, onEndMeeting }: Props) {
  const { lockSession, saveToRemote } = useSessionStore()
  const { getUserSessionNotes } = useListeningStore()
  const { updateMonthSummary } = useCalendarStore()

  const [summary, setSummary] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [isEnding, setIsEnding] = useState(false)
  const [viewMode, setViewMode] = useState<'track' | 'album'>('track')

  const myNotes = getUserSessionNotes(
    session.id,
    session.entries.map((e) => e.id),
    identity.userId,
    identity.userName,
  )
  const allMerged: UserSessionNotes[] = [
    myNotes,
    ...allNotes.filter((n) => n.userId !== identity.userId),
  ]

  async function sendEmail(text: string) {
    setEmailStatus('sending')
    try {
      await api.sendSummary({ summary: text, sessionMonth: session.id })
      setEmailStatus('sent')
    } catch {
      setEmailStatus('error')
    }
  }

  async function handleGenerate() {
    setIsGenerating(true)
    setGenError('')
    try {
      const result = await api.generateSummary({ session, allNotes: allMerged })
      setSummary(result.summary)
      if (emailStatus === 'idle') {
        void sendEmail(result.summary)
      }
    } catch (err) {
      setGenError((err as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleEndMeeting() {
    setIsEnding(true)
    const overallRatings: Record<string, number> = {}
    for (const entry of session.entries) {
      const ratings = allMerged
        .map((u) => resolveNoteRevision(u.entries[entry.id])?.rating ?? 0)
        .filter((r) => r > 0)
      overallRatings[entry.id] = ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0
    }

    lockSession(overallRatings)

    // Update calendar before remote save so the cell reflects done even if remote fails
    updateMonthSummary(session.month, {
      status: 'done',
      picks: session.entries.map((e) => ({ selector: e.selector, artist: e.artist, title: e.title })),
      overallRatings,
    })

    try {
      await saveToRemote()
    } catch {
      // Local state is already updated; remote failure is non-blocking
    }

    setIsEnding(false)
    onEndMeeting(overallRatings)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--accent)' }}>
              🎙️ Meeting in progress
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Walk through each album together. Generate a summary, then end the meeting.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-sm"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating…' : summary ? '↻ Regenerate' : '✨ Generate summary'}
            </button>
            <button
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: '#059669', color: '#fff', border: 'none' }}
              onClick={handleEndMeeting}
              disabled={isEnding}
            >
              {isEnding ? 'Ending…' : '✓ End meeting'}
            </button>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {(['track', 'album'] as const).map((mode) => (
          <button
            key={mode}
            className="px-3 py-1 text-xs rounded-md font-medium transition-colors"
            style={{
              background: viewMode === mode ? 'var(--accent)' : 'transparent',
              color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
            }}
            onClick={() => setViewMode(mode)}
          >
            {mode === 'track' ? 'By track' : 'By album'}
          </button>
        ))}
      </div>

      {/* Per-album sections */}
      {session.entries.map((entry) => {
        const ratings = allMerged
          .map((u) => resolveNoteRevision(u.entries[entry.id])?.rating ?? 0)
          .filter((r) => r > 0)
        const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

        return (
          <div
            key={entry.id}
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* Entry header */}
            <div
              className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
              style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <span className="text-lg mr-2">{entry.badge_emoji}</span>
                <span className="font-semibold">{entry.artist}</span>
                <span className="mx-1" style={{ color: 'var(--text-muted)' }}>—</span>
                <span style={{ color: 'var(--text-secondary)' }}>{entry.title}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--accent)' }}>
                  {entry.selector}'s pick
                </span>
              </div>
              {avgRating > 0 && (
                <span className="text-sm">
                  avg {'🎵'.repeat(Math.round(avgRating))} {avgRating.toFixed(1)}/5
                </span>
              )}
            </div>

            {/* Notes content */}
            {viewMode === 'track' ? (
              <TrackByTrackView entry={entry} allMerged={allMerged} />
            ) : (
              <div>
                {allMerged.map((userNotes) => (
                  <UserNoteAccordion
                    key={userNotes.userId}
                    userName={userNotes.userName || userNotes.userId.slice(0, 6)}
                    entryId={entry.id}
                    notes={userNotes}
                    tracklist={entry.tracklist}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Error */}
      {genError && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {genError.includes('503') ? 'Summary requires backend deployment.' : genError}
        </p>
      )}

      {/* AI Summary */}
      {summary && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-semibold">Meeting summary</h3>
            <div className="flex items-center gap-2">
              {emailStatus === 'sent' && (
                <span className="text-xs" style={{ color: '#059669' }}>✓ Sent to crew</span>
              )}
              {emailStatus === 'sending' && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sending…</span>
              )}
              {emailStatus === 'error' && (
                <button className="btn-ghost text-xs" onClick={() => sendEmail(summary)}>
                  ↻ Resend
                </button>
              )}
              <button
                className="btn-ghost text-xs"
                onClick={async () => {
                  await navigator.clipboard.writeText(summary)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          </div>
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
          />
        </div>
      )}
    </div>
  )
}
