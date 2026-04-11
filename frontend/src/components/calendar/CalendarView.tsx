import { useCalendarStore, getCalendarMonths, getCurrentMonth } from '../../store/calendarStore'
import MonthCell from './MonthCell'

interface Props {
  onSelectMonth: (month: string) => void
}

export default function CalendarView({ onSelectMonth }: Props) {
  const { getMonthSummary } = useCalendarStore()
  const months = getCalendarMonths()
  const currentMonth = getCurrentMonth()

  const years = [...new Set(months.map((m) => m.slice(0, 4)))]

  return (
    <div>
      {/* Hero */}
      <div className="flex items-center gap-4 mb-6">
        <img
          src="/logo-grid.jpg"
          alt="The Drunken Groove Society"
          className="w-24 h-24 object-contain rounded-xl flex-shrink-0"
          style={{ background: '#fff' }}
        />
        <div>
          <h1 className="text-xl font-bold">Sessions</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Dec 2025 — Dec 2026 · One pick per person per month
          </p>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-4 mb-5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {[
          { dot: 'var(--text-muted)',  label: 'No picks' },
          { dot: 'var(--accent)',      label: 'Albums selected' },
          { dot: '#d97706',            label: 'Notes in' },
          { dot: '#059669',            label: 'Meeting complete' },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
            {label}
          </span>
        ))}
      </div>

      {/* Calendar grid — grouped by year */}
      {years.map((year) => {
        const yearMonths = months.filter((m) => m.startsWith(year))
        return (
          <div key={year} className="mb-8">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              {year}
            </p>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
            >
              {yearMonths.map((month) => (
                <MonthCell
                  key={month}
                  month={month}
                  summary={getMonthSummary(month)}
                  isCurrent={month === currentMonth}
                  onClick={() => onSelectMonth(month)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
