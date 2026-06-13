import type { MonthSummary, SessionStatus } from '../../store/calendarStore'
import { formatMonthLabel } from '../../store/calendarStore'

interface Props {
  month: string
  summary: MonthSummary
  isCurrent: boolean
  onClick: () => void
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; dot: string; borderColor: string }> = {
  empty:     { label: 'No picks yet',      dot: 'var(--text-muted)',  borderColor: 'var(--border)' },
  picking:   { label: 'Picks in',          dot: 'var(--accent)',      borderColor: 'var(--accent)' },
  listening: { label: 'Listening',         dot: '#A0622A',            borderColor: '#A0622A' },
  done:      { label: 'Complete',          dot: '#2A6B4A',            borderColor: '#2A6B4A' },
}

function RatingDots({ rating }: { rating: number }) {
  const filled = Math.round(rating)
  return (
    <span className="flex items-center gap-0.5" title={`${rating.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="text-[10px] leading-none"
          style={{ color: i < filled ? 'var(--accent)' : 'var(--border)' }}
        >
          ●
        </span>
      ))}
      <span className="ml-1.5 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

export default function MonthCell({ month, summary, isCurrent, onClick }: Props) {
  const { short, long } = formatMonthLabel(month)
  const year = month.slice(0, 4)
  const cfg = STATUS_CONFIG[summary.status]
  const isDone = summary.status === 'done'

  const ratings = summary.overallRatings ? Object.values(summary.overallRatings) : []
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  return (
    <button
      className="w-full h-full text-left rounded-xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: 'var(--bg-surface)',
        border: `1.5px solid ${isCurrent && !isDone ? 'var(--accent)' : cfg.borderColor}`,
        boxShadow: isCurrent && !isDone ? '0 0 0 3px var(--accent-light)' : undefined,
      }}
      onClick={onClick}
      title={long}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
          <span className="text-sm font-bold tracking-tight">{short}</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{year}</span>
          {isCurrent && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
              style={{ background: isDone ? '#2A6B4A' : 'var(--accent)', color: '#fff' }}
            >
              {isDone ? 'Done' : 'Now'}
            </span>
          )}
        </div>
        {isDone && avgRating !== null && avgRating > 0 ? (
          <RatingDots rating={avgRating} />
        ) : (
          <span className="text-[10px] flex-shrink-0 uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>
            {cfg.label}
          </span>
        )}
      </div>

      {/* Picks */}
      <div className="space-y-2">
        {summary.picks.length > 0
          ? summary.picks.map((pick, i) => {
              const entryRating = summary.overallRatings
                ? Object.values(summary.overallRatings)[i]
                : undefined
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span
                      className="text-[11px] font-bold flex-shrink-0 uppercase tracking-wider"
                      style={{ color: 'var(--accent)' }}
                    >
                      {pick.selector}
                    </span>
                    <span className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {pick.artist || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {pick.title || ''}
                    </span>
                    {entryRating !== undefined && (
                      <span className="flex items-center gap-0.5 flex-shrink-0">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            className="text-[9px] leading-none"
                            style={{ color: i < Math.round(entryRating) ? 'var(--accent)' : 'var(--border)' }}
                          >
                            ●
                          </span>
                        ))}
                        <span className="ml-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          {entryRating.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          : [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2.5 rounded"
                style={{
                  background: 'var(--bg-elevated)',
                  width: `${55 + i * 14}%`,
                }}
              />
            ))}
      </div>
    </button>
  )
}
