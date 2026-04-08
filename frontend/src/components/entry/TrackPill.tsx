interface Props {
  track: string
  index: number
  onClick: (track: string) => void
}

export default function TrackPill({ track, index, onClick }: Props) {
  return (
    <button
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors active:scale-95"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
      onClick={() => onClick(track)}
      title={`Stamp "${track}" into notes`}
    >
      <span style={{ color: 'var(--text-muted)' }}>{index + 1}.</span>
      <span>{track}</span>
    </button>
  )
}
