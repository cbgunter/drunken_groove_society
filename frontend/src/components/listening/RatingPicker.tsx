interface Props {
  value: number   // 0 = unrated, 1-5
  onChange: (v: number) => void
  readOnly?: boolean
}

export default function RatingPicker({ value, onChange, readOnly = false }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium mr-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Rating
      </span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => !readOnly && onChange(value === n ? 0 : n)}
          className="text-base leading-none transition-transform hover:scale-125 active:scale-95 disabled:hover:scale-100"
          style={{ color: n <= value ? 'var(--accent)' : 'var(--border)' }}
          disabled={readOnly}
          title={readOnly ? undefined : `${n} / 5`}
          aria-label={`Rate ${n} out of 5`}
        >
          {n <= value ? '●' : '○'}
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm font-bold ml-1" style={{ color: 'var(--accent)' }}>
          {value}/5
        </span>
      )}
    </div>
  )
}
