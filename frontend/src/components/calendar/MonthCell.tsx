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
  picking:   { label: 'Albums selected',   dot: 'var(--accent)',      borderColor: 'var(--accent)' },
  listening: { label: 'Notes in',          dot: '#d97706',            borderColor: '#d97706' },
  done:      { label: 'Meeting complete',  dot: '#059669',            borderColor: '#059669' },
}

function RatingDots({ rating }: { rating: number }) {
  const filled = Math.round(rating)
  return (
    <span className="text-[11px]" title={`${rating.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ opacity: i < filled ? 1 : 0.2 }}>🎵</span>
      ))}
      <span className="ml-1 font-medium" style={{ color: 'var(--text-muted)' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

export default function MonthCell({ month, summary, isCurrent, onClick }: Props) {
  const { short, long } = formatMonthLabel(month)
  const cfg = STATUS_CONFIG[summary.status]
  const isDone = summary.status === 'done'

  // Compute avg overall rating for display
  const ratings = summary.overallRatings ? Object.values(summary.overallRatings) : []
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  return (
    <button
      className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: 'var(--bg-surface)',
        border: `1.5px solid ${isCurrent ? 'var(--accent)' : cfg.borderColor}`,
        boxShadow: isCurrent ? '0 0 0 2px var(--accent-light)' : undefined,
      }}
      onClick={onClick}
      title={long}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
          <span className="text-sm font-bold">{short}</span>
          {isCurrent && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Now
            </span>
          )}
        </div>
        {isDone && avgRating !== null && <RatingDots rating={avgRating} />}
        {!isDone && (
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {cfg.label}
          </span>
        )}
      </div>

      {/* Picks — full text, no truncation */}
      <div className="space-y-1.5">
        {summary.picks.length > 0
          ? summary.picks.map((pick, i) => {
              const entryRating = summary.overallRatings
                ? Object.values(summary.overallRatings)[i]
                : undefined
              return (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span
                      className="text-[11px] font-semibold flex-shrink-0"
                      style={{ color: 'var(--accent)' }}
                    >
                      {pick.selector}
                    </span>
                    <span className="text-[12px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {pick.artist || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-0">
                    <span className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {pick.title || ''}
                    </span>
                    {entryRating !== undefined && (
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {'🎵'.repeat(Math.round(entryRating))} {entryRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          : [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-3 rounded"
                style={{
                  background: 'var(--bg-elevated)',
                  width: `${60 + i * 12}%`,
                }}
              />
            ))}
      </div>
    </button>
  )
}
