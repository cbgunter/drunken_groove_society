import type { Session } from '../../types'
import { useSessionStore } from '../../store/sessionStore'
import { formatMonthLabel } from '../../store/calendarStore'
import PickCard from './PickCard'

interface Props {
  session: Session
  userName: string
  onSave: () => void
  isSaving: boolean
}

export default function SelectionView({ session, userName, onSave, isSaving }: Props) {
  const { updateEntry } = useSessionStore()
  const { long } = formatMonthLabel(session.month)

  // Show only this user's entry
  const myEntry = session.entries.find((e) => e.selector === userName)

  if (!myEntry) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">{long}</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          You ({userName}) don't have a pick slot this month. Check back when the crew has set up the session.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{long}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Enter your album pick, then look it up to auto-fill genre, tracklist, and fun facts.
        </p>
      </div>

      <PickCard
        entry={myEntry}
        onChange={(updates) => updateEntry(myEntry.id, updates)}
        onSave={onSave}
        isSaving={isSaving}
      />
    </div>
  )
}
