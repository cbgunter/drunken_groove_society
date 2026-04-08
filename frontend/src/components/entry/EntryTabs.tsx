import type { Entry } from '../../types'

interface Props {
  entries: Entry[]
  activeId: string
  onSelect: (id: string) => void
  locked: boolean
}

export default function EntryTabs({ entries, activeId, onSelect, locked }: Props) {
  return (
    <div
      className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1"
      role="tablist"
    >
      {entries.map((entry) => {
        const isActive = entry.id === activeId
        // Tab label: selector name + artist (if entered)
        const selectorLabel = entry.selector || `Entry`
        const label = entry.artist
          ? `${selectorLabel} · ${entry.artist}`
          : selectorLabel

        return (
          <button
            key={entry.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(entry.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0"
            style={{
              background: isActive ? 'var(--accent)' : 'var(--bg-surface)',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <span>{entry.badge_emoji}</span>
            <span className="max-w-[140px] truncate">{label}</span>
            {locked && (
              <span className="text-[10px] opacity-60">🔒</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
