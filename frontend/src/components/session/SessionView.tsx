import { useState } from 'react'
import type { Session, UserSessionNotes } from '../../types'
import { useSessionStore } from '../../store/sessionStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useNotesStore } from '../../store/notesStore'
import { formatMonthLabel } from '../../store/calendarStore'
import SelectionView from '../selection/SelectionView'
import ListeningView from '../listening/ListeningView'
import MeetingView from '../meeting/MeetingView'

interface Props {
  session: Session
  identity: { userId: string; userName: string }
  month: string
  onBack: () => void
}

function derivePhase(session: Session): 'selection' | 'listening' | 'done' {
  if (session.locked || session.phase === 'done') return 'done'
  // Listening phase: all picks have a tracklist (lookup was done) OR at least all have artist+title
  // We use tracklist as the signal that the full selection+lookup is complete
  const allHaveArtist = session.entries.every((e) => e.artist.trim() && e.title.trim())
  if (!allHaveArtist) return 'selection'
  return session.phase === 'listening' ? 'listening' : 'listening'
}

export default function SessionView({ session, identity, month, onBack }: Props) {
  const { saveToRemote, isSaving, updateSession } = useSessionStore()
  const { updateMonthSummary } = useCalendarStore()
  const { fetchPeerNotes, peerNotes } = useNotesStore()

  const [isSaved, setIsSaved] = useState(!session.locked ? false : true)
  const [meetingMode, setMeetingMode] = useState(false)
  const [allNotes, setAllNotes] = useState<UserSessionNotes[]>([])

  const phase = derivePhase(session)
  const { long } = formatMonthLabel(month)

  function syncCalendar(overrides?: { status?: 'picking' | 'listening' | 'done' }) {
    updateMonthSummary(month, {
      status: overrides?.status ?? (phase === 'done' ? 'done' : 'picking'),
      picks: session.entries.map((e) => ({ selector: e.selector, artist: e.artist, title: e.title })),
      overallRatings: session.overallRatings,
    })
  }

  async function handleSave() {
    await saveToRemote()
    setIsSaved(true)
    syncCalendar({ status: 'picking' })
  }

  async function handleStartMeeting() {
    if (isSaved) {
      await fetchPeerNotes(session.id)
    }
    setAllNotes(peerNotes)
    setMeetingMode(true)
  }

  function handleEndMeeting(overallRatings: Record<string, number>) {
    updateSession({})
    syncCalendar({ status: 'done' })
    setMeetingMode(false)
  }

  // ── Locked / done view ──────────────────────────────────────────────────
  if (phase === 'done' && !meetingMode) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} label={long} />
        <div
          className="rounded-lg px-3 py-2 text-sm flex items-center gap-2"
          style={{ background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46' }}
        >
          ✓ Meeting complete — session is read-only.
        </div>
        <ListeningView session={session} identity={identity} locked={true} />
      </div>
    )
  }

  // ── Meeting mode ────────────────────────────────────────────────────────
  if (meetingMode) {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} label={long} extra={
          <button className="btn-ghost text-xs" onClick={() => setMeetingMode(false)}>
            ← Back to listening
          </button>
        } />
        <MeetingView
          session={session}
          identity={identity}
          allNotes={allNotes}
          onEndMeeting={handleEndMeeting}
        />
      </div>
    )
  }

  // ── Selection phase ─────────────────────────────────────────────────────
  if (phase === 'selection') {
    return (
      <div className="space-y-4">
        <BackBar onBack={onBack} label={long} />
        <SelectionView session={session} onSave={handleSave} isSaving={isSaving} />
      </div>
    )
  }

  // ── Listening phase ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <BackBar onBack={onBack} label={long} extra={
        <button className="btn-primary text-xs" onClick={handleStartMeeting}>
          🎙️ Start meeting
        </button>
      } />
      {!isSaved && (
        <div className="flex justify-end">
          <button className="btn-ghost text-xs" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : '💾 Save changes'}
          </button>
        </div>
      )}
      <ListeningView session={session} identity={identity} locked={false} />
    </div>
  )
}

function BackBar({
  onBack,
  label,
  extra,
}: {
  onBack: () => void
  label: string
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <button
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onClick={onBack}
      >
        ← Calendar
      </button>
      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {extra}
    </div>
  )
}
