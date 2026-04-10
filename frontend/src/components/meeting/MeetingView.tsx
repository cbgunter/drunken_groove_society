import { useState } from 'react'
import type { Session, UserSessionNotes } from '../../types'
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

function RatingBadge({ rating }: { rating: number }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span className="font-semibold" style={{ color: 'var(--accent)' }}>
      {'🎵'.repeat(rating)} {rating}/5
    </span>
  )
}

function UserNoteColumn({
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
  const entry = notes.entries[entryId]
  if (!entry) {
    return (
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        No notes from {userName}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <RatingBadge rating={entry.current.rating} />
      {entry.current.albumNotes && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {entry.current.albumNotes}
        </p>
      )}
      {tracklist.map((track) => {
        const note = entry.current.trackNotes[track]
        if (!note) return null
        return (
          <div key={track}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
              {track}:{' '}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{note}</span>
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
  const [isEnding, setIsEnding] = useState(false)

  // Merge: local notes + fetched peer notes (de-duplicate by userId, local wins)
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

  async function handleGenerate() {
    setIsGenerating(true)
    setGenError('')
    try {
      const result = await api.generateSummary({ session, allNotes: allMerged })
      setSummary(result.summary)
    } catch (err) {
      setGenError((err as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleEndMeeting() {
    setIsEnding(true)
    // Compute combined ratings per entry (average of all users who rated)
    const overallRatings: Record<string, number> = {}
    for (const entry of session.entries) {
      const ratings = allMerged
        .map((u) => u.entries[entry.id]?.current.rating ?? 0)
        .filter((r) => r > 0)
      overallRatings[entry.id] = ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0
    }

    lockSession(overallRatings)
    await saveToRemote()

    // Update calendar cell
    updateMonthSummary(session.month, {
      status: 'done',
      picks: session.entries.map((e) => ({ selector: e.selector, artist: e.artist, title: e.title })),
      overallRatings,
    })

    setIsEnding(false)
    onEndMeeting(overallRatings)
  }

  return (
    <div className="space-y-6">
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
              Walk through each album together. Generate a summary, then end the meeting when done.
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

      {/* Per-album notes comparison */}
      {session.entries.map((entry) => {
        const avgRating = (() => {
          const ratings = allMerged
            .map((u) => u.entries[entry.id]?.current.rating ?? 0)
            .filter((r) => r > 0)
          return ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
        })()

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

            {/* Notes columns */}
            <div
              className="grid divide-x"
              style={{
                gridTemplateColumns: `repeat(${allMerged.length}, 1fr)`,
                borderColor: 'var(--border)',
              }}
            >
              {allMerged.map((userNotes) => (
                <div key={userNotes.userId} className="p-3 space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    {userNotes.userName || userNotes.userId.slice(0, 6)}
                  </p>
                  <UserNoteColumn
                    userName={userNotes.userName}
                    entryId={entry.id}
                    notes={userNotes}
                    tracklist={entry.tracklist}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* AI Summary */}
      {genError && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {genError.includes('503') ? 'Summary requires backend deployment.' : genError}
        </p>
      )}

      {summary && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Meeting summary</h3>
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
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
          />
        </div>
      )}
    </div>
  )
}
