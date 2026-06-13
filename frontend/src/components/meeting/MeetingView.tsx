import { useState } from 'react'
import type { Entry, NoteRevision, Session, TrackReaction, UserSessionNotes } from '../../types'
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

const REACTION_CONFIG: Record<TrackReaction, { label: string; color: string; text: string }> = {
  loved: { label: 'Loved it', color: '#d1fae5', text: '#065f46' },
  mixed: { label: 'Mixed',    color: '#fef3c7', text: '#92400e' },
  meh:   { label: 'Meh',      color: 'var(--bg-elevated)', text: 'var(--text-muted)' },
}

function ReactionPill({ reaction, count }: { reaction: TrackReaction; count: number }) {
  const cfg = REACTION_CONFIG[reaction]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: cfg.color, color: cfg.text }}
    >
      {cfg.label} {count}
    </span>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="text-xs" style={{ color: i < rating ? 'var(--accent)' : 'var(--border)' }}>●</span>
      ))}
      <span className="ml-1 text-xs font-semibold" style={{ color: 'var(--accent)' }}>{rating}/5</span>
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

  // Build per-track signal data
  const trackData = entry.tracklist.map((track, i) => {
    const userNotes = allMerged
      .map((u) => {
        const rev = resolveNoteRevision(u.entries[entry.id])
        return {
          name: u.userName || u.userId.slice(0, 6),
          note: rev?.trackNotes?.[track],
          reaction: rev?.trackReactions?.[track] as TrackReaction | undefined,
        }
      })
      .filter((x) => x.note?.trim() || x.reaction)

    const reactionCounts = { loved: 0, mixed: 0, meh: 0 } as Record<TrackReaction, number>
    userNotes.forEach((x) => { if (x.reaction) reactionCounts[x.reaction]++ })

    return { track, index: i, userNotes, reactionCounts, hasSignal: userNotes.length > 0 }
  })

  const withSignal = trackData.filter((t) => t.hasSignal)
  const withoutSignal = trackData.filter((t) => !t.hasSignal)

  function renderTrack({ track, index, userNotes, reactionCounts }: typeof trackData[0]) {
    return (
      <div key={index} className="px-3 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            {index + 1}. {track}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {(Object.entries(reactionCounts) as [TrackReaction, number][])
              .filter(([, count]) => count > 0)
              .map(([reaction, count]) => (
                <ReactionPill key={reaction} reaction={reaction} count={count} />
              ))}
          </div>
        </div>
        <div className="space-y-1">
          {userNotes.map(({ name, note, reaction }) => (
            <div key={name} className="flex gap-2 text-xs items-baseline">
              <span className="font-semibold flex-shrink-0" style={{ color: 'var(--accent)' }}>
                {name}:
              </span>
              {note ? (
                <span style={{ color: 'var(--text-primary)' }}>{note}</span>
              ) : reaction ? (
                <span className="italic" style={{ color: 'var(--text-muted)' }}>
                  {REACTION_CONFIG[reaction].label.toLowerCase()}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {withSignal.map(renderTrack)}
      {withoutSignal.length > 0 && (
        <div className="px-3 py-2" style={{ opacity: 0.4 }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            No notes — {withoutSignal.map((t) => t.track).join(', ')}
          </p>
        </div>
      )}
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
              Meeting in progress
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
              {isGenerating ? 'Generating…' : summary ? '↻ Regenerate' : 'Generate summary'}
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

        // Find the picker's "why I picked this" note
        const pickerUserNotes = allMerged.find((u) => u.userName === entry.selector)
        const pickerNote = resolveNoteRevision(pickerUserNotes?.entries[entry.id])?.pickerNote

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
                <span
                  className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {entry.selector[0]?.toUpperCase()}
                </span>
                <span className="font-semibold">{entry.artist}</span>
                <span className="mx-1" style={{ color: 'var(--text-muted)' }}>—</span>
                <span style={{ color: 'var(--text-secondary)' }}>{entry.title}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--accent)' }}>
                  {entry.selector}'s pick
                </span>
              </div>
              {avgRating > 0 && (
                <span className="flex items-center gap-0.5 text-sm">
                  <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>avg</span>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className="text-xs" style={{ color: i < Math.round(avgRating) ? 'var(--accent)' : 'var(--border)' }}>●</span>
                  ))}
                  <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{avgRating.toFixed(1)}/5</span>
                </span>
              )}
            </div>

            {/* Picker's intro — why they chose this album */}
            {pickerNote && (
              <div
                className="px-4 py-3 flex gap-3"
                style={{ background: 'var(--accent-light)', borderBottom: '1px solid var(--accent)' }}
              >
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {entry.selector[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--accent)' }}>
                    Why {entry.selector} picked it
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {pickerNote}
                  </p>
                </div>
              </div>
            )}

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
                {copied ? '✓ Copied' : 'Copy'}
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
