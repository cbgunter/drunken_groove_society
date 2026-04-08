import type { Session } from '../../types'
import { useSessionStore } from '../../store/sessionStore'
import { formatMonthLabel } from '../../store/calendarStore'
import PickCard from './PickCard'

interface Props {
  session: Session
  onSave: () => void
  isSaving: boolean
}

export default function SelectionView({ session, onSave, isSaving }: Props) {
  const { updateEntry } = useSessionStore()
  const { long } = formatMonthLabel(session.month)

  const allPicked = session.entries.every((e) => e.artist.trim() && e.title.trim())

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{long}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Each person picks one album. Enter the band and title, then click "Look up" to
          auto-fill genre, tracklist, and fun facts.
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {session.entries.map((entry) => (
          <PickCard
            key={entry.id}
            entry={entry}
            onChange={(updates) => updateEntry(entry.id, updates)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {allPicked
            ? 'All picks entered. Save to share with the crew.'
            : 'Enter at least band and album title for each person to continue.'}
        </p>
        <button
          className="btn-primary"
          onClick={onSave}
          disabled={isSaving || !allPicked}
          title={!allPicked ? 'Enter all 3 picks first' : undefined}
        >
          {isSaving ? 'Saving…' : '💾 Save picks & share'}
        </button>
      </div>
    </div>
  )
}
