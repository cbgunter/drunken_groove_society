import { useRef, useState } from 'react'
import type { Entry } from '../../types'
import { useSessionStore } from '../../store/sessionStore'
import EntryMeta from './EntryMeta'
import EntryForm from './EntryForm'
import RichTextBlock from './RichTextBlock'
import FunFacts from './FunFacts'
import Tracklist from './Tracklist'
import NotesArea, { type NotesAreaHandle } from '../notes/NotesArea'

interface Props {
  entry: Entry
  sessionId: string
  userId: string
  locked: boolean
}

export default function EntryPanel({ entry, sessionId, userId, locked }: Props) {
  const { updateEntry } = useSessionStore()
  const [editing, setEditing] = useState(
    // Auto-open edit form if entry is blank and not locked
    !locked && !entry.artist && !entry.title,
  )
  const notesRef = useRef<NotesAreaHandle>(null)

  function handleTrackClick(track: string) {
    notesRef.current?.stamp(track)
  }

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {editing ? (
        <EntryForm
          entry={entry}
          onChange={(updates) => updateEntry(entry.id, updates)}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <EntryMeta entry={entry} />
            {!locked && (
              <button
                className="btn-ghost text-xs flex-shrink-0"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
          </div>

          {(entry.about_band || entry.about_album) && (
            <div className="space-y-2">
              <RichTextBlock label="About the band" content={entry.about_band} />
              <RichTextBlock label="About the album" content={entry.about_album} />
            </div>
          )}

          <FunFacts facts={entry.fun_facts} />

          <Tracklist tracks={entry.tracklist} onTrackClick={handleTrackClick} />
        </>
      )}

      {/* Notes always visible in view mode */}
      {!editing && (
        <div
          className="pt-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <NotesArea
            ref={notesRef}
            sessionId={sessionId}
            entryId={entry.id}
            userId={userId}
            readOnly={locked}
          />
        </div>
      )}
    </div>
  )
}
