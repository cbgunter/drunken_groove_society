import { useState } from 'react'

interface Props {
  facts: string[]
}

export default function FunFacts({ facts }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (!facts.length) return null

  const visible = showAll ? facts : facts.slice(0, 3)

  return (
    <div
      className="rounded-lg px-3 py-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
        Fun facts
      </p>
      <ul className="space-y-1">
        {visible.map((fact, i) => (
          <li key={i} className="flex gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>•</span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
      {facts.length > 3 && (
        <button
          className="mt-2 text-xs"
          style={{ color: 'var(--accent)' }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `+${facts.length - 3} more`}
        </button>
      )}
    </div>
  )
}
