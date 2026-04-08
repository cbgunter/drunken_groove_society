import { useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'

interface Props {
  isSaved: boolean
  onSave: () => void
  isSaving: boolean
  locked: boolean
}

export default function SessionHeader({ isSaved, onSave, isSaving, locked }: Props) {
  const { session, updateSession } = useSessionStore()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  if (!session) return null

  function startEdit() {
    if (locked) return
    setTitleDraft(session!.title)
    setEditingTitle(true)
  }

  function commitTitle() {
    if (titleDraft.trim()) updateSession({ title: titleDraft.trim() })
    setEditingTitle(false)
  }

  // Format the month label
  const [year, mon] = session.month?.split('-') ?? session.date.split('-')
  const monthLabel = new Date(Number(year), Number(mon) - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
        {monthLabel}
      </p>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              className="text-xl font-bold w-full rounded px-1 outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent)',
                color: 'var(--text-primary)',
              }}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && commitTitle()}
            />
          ) : (
            <h1
              className={`text-xl font-bold truncate ${!locked ? 'cursor-pointer' : ''}`}
              onClick={startEdit}
              title={!locked ? 'Click to edit title' : undefined}
            >
              {session.title || monthLabel}
            </h1>
          )}
        </div>

        {!locked && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="btn-primary text-xs"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : isSaved ? 'Save changes' : 'Save & share'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
