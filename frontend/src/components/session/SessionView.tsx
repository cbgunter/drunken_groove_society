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

function derivePhase(session: Session, userName: string): 'selection' | 'listening' | 'done' {
  if (session.locked || session.phase === 'done') return 'done'
  // Only check the current user's pick — they can start listening once their own is saved
  const myEntry = session.entries.find((e) => e.selector === userName)
  if (!myEntry || !myEntry.artist.trim() || !myEntry.title.trim()) return 'selection'
  return 'listening'
}

export default function SessionView({ session, identity, month, onBack }: Props) {
  const { saveToRemote, isSaving, error: saveError, unlockSession } = useSessionStore()
  const { updateMonthSummary } = useCalendarStore()
  const { fetchPeerNotes, peerFetchError, isFetchingPeers } = useNotesStore()

  const [isSaved, setIsSaved] = useState(!session.locked ? false : true)
  const [meetingMode, setMeetingMode] = useState(false)
  const [allNotes, setAllNotes] = useState<UserSessionNotes[]>([])
  const [isEditingPick, setIsEditingPick] = useState(false)

  const phase = derivePhase(session, identity.userName)
  const { long } = formatMonthLabel(month)

  async function handleSave() {
    await saveToRemote()
    setIsSaved(true)
    // Read live store state to avoid stale closure — session may have been updated
    // since the last render (e.g., lookup completed after the component re-rendered)
    const live = useSessionStore.getState().session
    if (live) {
      const hasAnyPick = live.entries.some((e) => e.artist.trim())
      updateMonthSummary(month, {
        status: live.locked ? 'done' : hasAnyPick ? 'listening' : 'picking',
        picks: live.entries.map((e) => ({ selector: e.selector, artist: e.artist, title: e.title })),
        overallRatings: live.overallRatings,
      })
    }
  }

  async function handleStartMeeting() {
    await fetchPeerNotes(session.id)
    setAllNotes(useNotesStore.getState().peerNotes)
    setMeetingMode(true)
  }

  function handleEndMeeting(_overallRatings: Record<string, number>) {
    setMeetingMode(false)
  }

  async function handleRetryNotes() {
    await fetchPeerNotes(session.id, true)
    setAllNotes(useNotesStore.getState().peerNotes)
  }

  async function handleUnlock() {
    unlockSession()
    await saveToRemote()
  }

  // ── Locked / done view ──────────────────────────────────────────────────
  if (phase === 'done' && !meetingMode) {
    return (
      <div className="space-y-4">
        <BackBar
          onBack={onBack}
          label={long}
          extra={
            <button
              className="btn-ghost text-xs"
              onClick={handleUnlock}
              disabled={isSaving}
            >
              {isSaving ? 'Unlocking…' : 'Unlock session'}
            </button>
          }
        />
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
        {peerFetchError && (
          <div className="text-xs px-3 py-2 rounded-lg flex items-center justify-between gap-3" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
            <span>Could not load peer notes. Showing local notes only.</span>
            <button
              className="btn-ghost text-xs flex-shrink-0"
              onClick={handleRetryNotes}
              disabled={isFetchingPeers}
            >
              {isFetchingPeers ? 'Loading…' : 'Retry'}
            </button>
          </div>
        )}
        <MeetingView
          session={session}
          identity={identity}
          allNotes={allNotes}
          onEndMeeting={handleEndMeeting}
        />
      </div>
    )
  }

  // ── Selection phase (or editing an existing pick) ──────────────────────
  if (phase === 'selection' || isEditingPick) {
    return (
      <div className="space-y-4">
        <BackBar
          onBack={onBack}
          label={long}
          extra={
            isEditingPick ? (
              <button className="btn-ghost text-xs" onClick={() => setIsEditingPick(false)}>
                ← Cancel
              </button>
            ) : undefined
          }
        />
        {saveError && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            Save failed — check your connection and try again.
          </div>
        )}
        <SelectionView
          session={session}
          userName={identity.userName}
          onSave={async () => { await handleSave(); setIsEditingPick(false) }}
          isSaving={isSaving}
        />
      </div>
    )
  }

  // ── Listening phase ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <BackBar onBack={onBack} label={long} extra={
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={() => setIsEditingPick(true)}>
            ✎ Edit pick
          </button>
          <button className="btn-primary text-xs" onClick={handleStartMeeting}>
            Start meeting
          </button>
        </div>
      } />
      {!isSaved && (
        <div className="flex justify-end items-center gap-2">
          {saveError && (
            <span className="text-xs" style={{ color: '#b91c1c' }}>Save failed</span>
          )}
          <button className="btn-ghost text-xs" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : saveError ? 'Retry' : 'Save changes'}
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
