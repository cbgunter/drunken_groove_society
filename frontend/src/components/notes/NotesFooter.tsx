import { useState } from 'react'
import type { Session } from '../../types'
import { useNotesStore } from '../../store/notesStore'

interface Props {
  session: Session
  identity: { userId: string; userName: string }
  isSaved: boolean
  onNotesSubmitted?: () => void
}

export default function NotesFooter({ session, identity, isSaved, onNotesSubmitted }: Props) {
  const {
    hasSubmitted,
    submitNotes,
    fetchPeerNotes,
    peerNotes,
    isSubmitting,
    isFetchingPeers,
    submitError,
  } = useNotesStore()

  const [showPeers, setShowPeers] = useState(false)
  const submitted = hasSubmitted(session.id)

  async function handleSubmit() {
    const entryIds = session.entries.map((e) => e.id)
    await submitNotes(session.id, identity.userId, identity.userName, entryIds)
    onNotesSubmitted?.()
  }

  async function handleShowPeers() {
    const next = !showPeers
    setShowPeers(next)
    if (next) await fetchPeerNotes(session.id)
  }

  async function handleRefresh() {
    await fetchPeerNotes(session.id)
  }

  return (
    <div
      className="mt-6 rounded-xl p-4 space-y-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold">Meeting time</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {submitted
              ? 'Your notes are shared. Compare below.'
              : isSaved
              ? 'Ready to share your listening notes with the crew?'
              : 'Save the session first, then share your notes.'}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!submitted ? (
            <button
              className="btn-primary text-sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !isSaved}
              title={!isSaved ? 'Save the session first' : undefined}
            >
              {isSubmitting ? 'Sharing…' : '📤 Share my notes'}
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--accent)' }}
            >
              ✓ Notes shared
            </span>
          )}

          <button
            className="btn-ghost text-sm"
            onClick={handleShowPeers}
          >
            {showPeers ? 'Hide notes' : '👥 Compare notes'}
          </button>
        </div>
      </div>

      {submitError && (
        <p className="text-xs" style={{ color: '#dc2626' }}>
          Error sharing notes: {submitError}
        </p>
      )}

      {showPeers && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Crew notes
            </p>
            <button
              className="text-xs"
              style={{ color: 'var(--accent)' }}
              onClick={handleRefresh}
              disabled={isFetchingPeers}
            >
              {isFetchingPeers ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {peerNotes.length === 0 ? 'No notes shared yet.' : `${peerNotes.length} member(s) have shared notes.`}
          </div>
        </div>
      )}
    </div>
  )
}
