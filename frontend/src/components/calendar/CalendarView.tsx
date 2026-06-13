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
      {/* Header row: title + legend */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold leading-tight">Sessions</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Rolling 12 months · One pick per person per month
          </p>
        </div>
        <div className="flex items-center gap-5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {[
            { dot: 'var(--text-muted)',  label: 'No picks' },
            { dot: 'var(--accent)',      label: 'Picks in' },
            { dot: '#A0622A',            label: 'Listening' },
            { dot: '#2A6B4A',            label: 'Complete' },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Fixed 4-column grid → clean 4×3 for 12 months */}
      <div className="grid grid-cols-4 gap-3 items-stretch">
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
