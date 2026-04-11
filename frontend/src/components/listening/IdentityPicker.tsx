interface Props {
  roster: string[]
  userName: string
  onSelect: (name: string) => void
}

export default function IdentityPicker({ roster, userName, onSelect }: Props) {
  // Compact inline version once name is chosen
  if (userName) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Listening as:</span>
        {roster.map((name) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: name === userName ? 'var(--accent)' : 'var(--bg-elevated)',
              color: name === userName ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${name === userName ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {name}
          </button>
        ))}
      </div>
    )
  }

  // Prominent prompt when no identity set
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--accent-light)', border: '1.5px solid var(--accent)' }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Who's listening?</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Select your name so your notes are saved correctly.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {roster.map((name) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="btn-primary text-sm"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
