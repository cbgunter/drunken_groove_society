interface Props {
  value: number   // 0 = unrated, 1-5
  onChange: (v: number) => void
  readOnly?: boolean
}

export default function RatingPicker({ value, onChange, readOnly = false }: Props) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>Rating</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => !readOnly && onChange(value === n ? 0 : n)}
          className="text-xl leading-none transition-transform hover:scale-125 active:scale-95 disabled:hover:scale-100"
          style={{ opacity: n <= value ? 1 : 0.2 }}
          disabled={readOnly}
          title={readOnly ? undefined : `${n} / 5`}
          aria-label={`Rate ${n} out of 5`}
        >
          🎵
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm font-semibold ml-1" style={{ color: 'var(--accent)' }}>
          {value}/5
        </span>
      )}
    </div>
  )
}
