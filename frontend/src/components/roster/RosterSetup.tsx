import { useState } from 'react'
import { useCalendarStore } from '../../store/calendarStore'

interface Props {
  onDone: () => void
  isEdit?: boolean
}

export default function RosterSetup({ onDone, isEdit = false }: Props) {
  const { roster, setRoster } = useCalendarStore()
  const [names, setNames] = useState<[string, string, string]>(
    roster ?? ['', '', ''],
  )

  function updateName(i: number, val: string) {
    setNames((prev) => {
      const next = [...prev] as [string, string, string]
      next[i] = val
      return next
    })
  }

  function handleSave() {
    const filled = names.map((n) => n.trim()) as [string, string, string]
    setRoster(filled)
    onDone()
  }

  const inputStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      {!isEdit && (
        <div className="text-center">
          <div className="text-4xl mb-3">🍺</div>
          <h1 className="text-2xl font-bold mb-1">Who's in the crew?</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Each person picks one album per month. Enter your names to get started.
          </p>
        </div>
      )}

      <div
        className="w-full max-w-sm rounded-xl p-6 space-y-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {isEdit && (
          <h2 className="text-base font-semibold">Edit crew</h2>
        )}

        <div className="space-y-3">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="text-sm font-medium w-16 flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                Member {i + 1}
              </span>
              <input
                type="text"
                placeholder={`e.g. ${['Marcus', 'Sarah', 'Dave'][i]}`}
                value={name}
                onChange={(e) => updateName(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && i === 2 && handleSave()}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
                autoFocus={i === 0}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {isEdit && (
            <button className="btn-ghost flex-1 justify-center" onClick={onDone}>
              Cancel
            </button>
          )}
          <button className="btn-primary flex-1 justify-center" onClick={handleSave}>
            {isEdit ? 'Save changes' : "Let's go"}
          </button>
        </div>
      </div>
    </div>
  )
}
