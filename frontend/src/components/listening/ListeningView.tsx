import { useRef, useState } from 'react'
import type { Session, Entry } from '../../types'
import { useSessionStore } from '../../store/sessionStore'
import { useListeningStore } from '../../store/listeningStore'
import EntryMeta from '../entry/EntryMeta'
import RatingPicker from './RatingPicker'
import NoteHistory from './NoteHistory'

interface Props {
  session: Session
  identity: { userId: string; userName: string }
  locked: boolean
}

function TrackPillNotes({
  tracks,
  trackNotes,
  onChange,
  readOnly,
}: {
  tracks: string[]
  trackNotes: Record<string, string>
  onChange: (track: string, note: string) => void
  readOnly: boolean
}) {
  const [activeTrack, setActiveTrack] = useState<string | null>(null)

  if (!tracks.length) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Track notes
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tracks.map((track, i) => {
          const hasNote = !!trackNotes[track]?.trim()
          const isActive = activeTrack === track
          return (
            <button
              key={i}
              onClick={() => setActiveTrack(isActive ? null : track)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all"
              style={{
                background: isActive ? 'var(--accent)' : hasNote ? 'var(--accent-light)' : 'var(--bg-elevated)',
                border: `1px solid ${isActive ? 'var(--accent)' : hasNote ? 'var(--accent)' : 'var(--border)'}`,
                color: isActive ? '#fff' : hasNote ? 'var(--accent)' : 'var(--text-secondary)',
              }}
              title={track}
            >
              <span style={{ opacity: 0.6 }}>{i + 1}.</span>
              <span>{track}</span>
              {hasNote && !isActive && <span>✎</span>}
            </button>
          )
        })}
      </div>
      {activeTrack && (
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Notes for: <strong>{activeTrack}</strong>
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm resize-y min-h-[72px] outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--accent)',
              color: 'var(--text-primary)',
            }}
            placeholder="What stood out about this track?"
            value={trackNotes[activeTrack] ?? ''}
            readOnly={readOnly}
            onChange={(e) => !readOnly && onChange(activeTrack, e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

function ListeningHints({ entry }: { entry: Entry }) {
  const hasContent = entry.about_band || entry.about_album || entry.fun_facts.length > 0

  if (!hasContent) return null

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
        Listening Hints
      </h3>

      {/* Genre tags */}
      {entry.genre_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.genre_tags.map((tag) => (
            <span key={tag} className="pill text-[10px]">{tag}</span>
          ))}
          {entry.year > 0 && <span className="pill text-[10px]">{entry.year}</span>}
          {entry.format !== 'Other' && entry.format !== 'LP' && (
            <span className="pill text-[10px]">{entry.format}</span>
          )}
        </div>
      )}

      {/* About sections */}
      {entry.about_band && (
        <div>
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>About the band</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{entry.about_band}</p>
        </div>
      )}
      {entry.about_album && (
        <div>
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>About the album</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{entry.about_album}</p>
        </div>
      )}

      {/* Fun facts */}
      {entry.fun_facts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Quick facts</p>
          <ul className="space-y-1">
            {entry.fun_facts.map((fact, i) => (
              <li key={i} className="text-xs leading-relaxed flex gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <span className="flex-shrink-0" style={{ color: 'var(--accent)' }}>•</span>
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tracklist */}
      {entry.tracklist.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Tracklist</p>
          <div className="flex flex-wrap gap-1">
            {entry.tracklist.map((track, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {i + 1}. {track}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ListeningView({ session, identity, locked }: Props) {
  const { activeEntryId, setActiveEntry } = useSessionStore()
  const { getDraft, setDraft, setRating, getRating, getHistory, saveDraft, isSaving } =
    useListeningStore()

  const activeEntry = session.entries.find((e) => e.id === activeEntryId) ?? session.entries[0]

  if (!activeEntry) return null

  const albumNotes = getDraft(session.id, activeEntry.id, 'album')
  const trackNotes = getDraft(session.id, activeEntry.id, 'tracks') as Record<string, string>
  const rating = getRating(session.id, activeEntry.id)
  const history = getHistory(session.id, activeEntry.id)

  async function handleSave() {
    await saveDraft(session.id, activeEntry.id, identity.userId, identity.userName)
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {session.entries.map((entry) => {
          const isActive = entry.id === activeEntry.id
          return (
            <button
              key={entry.id}
              onClick={() => setActiveEntry(entry.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--bg-surface)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {entry.badge_emoji} {entry.selector}
            </button>
          )
        })}
      </div>

      {/* Album card */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <EntryMeta entry={activeEntry} />

        {activeEntry.external_link && (
          <a
            href={activeEntry.external_link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            ▶ {activeEntry.external_link.label}
          </a>
        )}
      </div>

      {/* Listening Hints */}
      <ListeningHints entry={activeEntry} />

      {/* Notes section */}
      <div
        className="rounded-xl p-4 space-y-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Your notes</h3>
          <RatingPicker
            value={rating}
            onChange={(v) => setRating(session.id, activeEntry.id, v)}
            readOnly={locked}
          />
        </div>

        {/* Album-level notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Album notes
          </label>
          <textarea
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-y min-h-[200px] outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              lineHeight: '1.6',
            }}
            placeholder="Overall impressions, themes, how it made you feel…"
            value={typeof albumNotes === 'string' ? albumNotes : ''}
            readOnly={locked}
            onChange={(e) => !locked && setDraft(session.id, activeEntry.id, 'album', e.target.value)}
          />
        </div>

        {/* Per-track notes */}
        <TrackPillNotes
          tracks={activeEntry.tracklist}
          trackNotes={typeof trackNotes === 'object' ? trackNotes : {}}
          onChange={(track, note) => {
            const next = { ...(typeof trackNotes === 'object' ? trackNotes : {}), [track]: note }
            setDraft(session.id, activeEntry.id, 'tracks', next)
          }}
          readOnly={locked}
        />

        {/* Save + history */}
        {!locked && (
          <div className="flex items-center justify-between pt-1 gap-3 flex-wrap">
            <NoteHistory history={history} />
            <button
              className="btn-primary text-sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : '💾 Save notes'}
            </button>
          </div>
        )}
        {locked && history.length > 0 && <NoteHistory history={history} />}
      </div>
    </div>
  )
}
