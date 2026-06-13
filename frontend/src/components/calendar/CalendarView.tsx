import { useCalendarStore, getCalendarMonths, getCurrentMonth } from '../../store/calendarStore'
import type { MonthSummary } from '../../store/calendarStore'
import MonthCell from './MonthCell'

interface Props {
  onSelectMonth: (month: string) => void
}

export default function CalendarView({ onSelectMonth }: Props) {
  const { getMonthSummary } = useCalendarStore()
  const months = getCalendarMonths()
  const currentMonth = getCurrentMonth()

  function effectiveSummary(month: string, summary: MonthSummary): MonthSummary {
    // Past months with any picks display as done — they've been listened to
    if (month < currentMonth && summary.status !== 'empty') {
      return { ...summary, status: 'done' }
    }
    return summary
  }

  return (
    <div>
      {/* Hero */}
      <div className="flex items-center gap-4 mb-6">
        <img
          src="/logo-grid.jpg"
          alt="The Drunken Groove Society"
          className="w-20 h-20 object-contain rounded-xl flex-shrink-0"
          style={{ background: '#fff' }}
        />
        <div>
          <h1 className="text-xl font-bold">Sessions</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Rolling 12 months · One pick per person per month
          </p>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-5 mb-6 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {[
          { dot: 'var(--text-muted)',  label: 'No picks' },
          { dot: 'var(--accent)',      label: 'Picks in' },
          { dot: '#A0622A',            label: 'Listening' },
          { dot: '#2A6B4A',            label: 'Complete' },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
            {label}
          </span>
        ))}
      </div>

      {/* Responsive grid: 2 cols mobile → 3 tablet → 4 desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch">
        {months.map((month) => {
          const summary = effectiveSummary(month, getMonthSummary(month))
          return (
            <MonthCell
              key={month}
              month={month}
              summary={summary}
              isCurrent={month === currentMonth}
              onClick={() => onSelectMonth(month)}
            />
          )
        })}
      </div>
    </div>
  )
}
