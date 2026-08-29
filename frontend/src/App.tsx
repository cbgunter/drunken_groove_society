import { useEffect, useState } from 'react'
import { useSessionStore } from './store/sessionStore'
import { useCalendarStore } from './store/calendarStore'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import CalendarView from './components/calendar/CalendarView'
import SessionView from './components/session/SessionView'
import RosterSetup from './components/roster/RosterSetup'
import { HISTORIC_SESSIONS, HISTORIC_ROSTER, SEED_VERSION, SKIPPED_MONTHS } from './utils/historicSeed'

type View = 'calendar' | 'month' | 'roster-setup' | 'roster-edit'

export default function App() {
  const { session, isLoading, error, loadOrCreateForMonth } = useSessionStore()
  const { roster, seedVersion, setRoster, putLocalSession, updateMonthSummary, markSeeded } =
    useCalendarStore()
  // AuthGate guarantees a signed-in user by the time App ever renders.
  const userId = useAuthStore((s) => s.userId!)
  const userName = useAuthStore((s) => s.userName!)
  const signOut = useAuthStore((s) => s.signOut)

  const [view, setView] = useState<View>('calendar')
  const [activeMonth, setActiveMonth] = useState<string | null>(null)

  // Seed historic data — re-runs whenever SEED_VERSION is bumped
  useEffect(() => {
    if (seedVersion >= SEED_VERSION) return
    // Set roster from historic data if not already configured
    if (!roster) setRoster(HISTORIC_ROSTER)
    // Populate local session cache + calendar summaries
    for (const session of HISTORIC_SESSIONS) {
      putLocalSession(session)
      updateMonthSummary(session.month, {
        status: SKIPPED_MONTHS.has(session.month) ? 'skipped' : session.locked ? 'done' : session.phase === 'listening' ? 'listening' : 'picking',
        picks: session.entries.map((e) => ({
          selector: e.selector,
          artist: e.artist,
          title: e.title,
        })),
        overallRatings: session.overallRatings,
      })
    }
    markSeeded(SEED_VERSION)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL param on initial load (deep-link to a month)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const month = params.get('month')
    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      if (!roster) {
        // Need roster first before loading a month
        setView('roster-setup')
      } else {
        setActiveMonth(month)
        setView('month')
        loadOrCreateForMonth(month, roster)
      }
    } else if (!roster) {
      setView('roster-setup')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectMonth(month: string) {
    if (!roster) {
      setView('roster-setup')
      return
    }
    setActiveMonth(month)
    setView('month')
    const url = new URL(window.location.href)
    url.searchParams.set('month', month)
    window.history.pushState({}, '', url.toString())
    loadOrCreateForMonth(month, roster)
  }

  function handleBackToCalendar() {
    setView('calendar')
    setActiveMonth(null)
    window.history.pushState({}, '', window.location.pathname)
  }

  function handleRosterDone() {
    const { roster: newRoster } = useCalendarStore.getState()
    // If we were deep-linking to a month, continue there
    const params = new URLSearchParams(window.location.search)
    const month = params.get('month')
    if (month && newRoster) {
      setActiveMonth(month)
      setView('month')
      loadOrCreateForMonth(month, newRoster)
    } else {
      setView('calendar')
    }
  }

  // Cognito's `name` claim, the roster names, and Entry.selector all need to
  // match exactly — see the identity mapping notes in the auth rollout plan.
  // If they drift, phase detection silently gets stuck; surface it instead.
  const rosterMismatch = roster !== null && !roster.includes(userName)

  return (
    <AppShell onHome={handleBackToCalendar} userName={userName} onSignOut={signOut}>
      {rosterMismatch && (
        <div
          className="mb-4 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-3 flex-wrap"
          style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
        >
          <span>
            You're signed in as <strong>{userName}</strong>, but the crew is set to {roster!.join(', ')}.
          </span>
          <button className="btn-ghost text-xs flex-shrink-0" onClick={() => setView('roster-edit')}>
            Edit crew
          </button>
        </div>
      )}

      {/* Views */}
      {view === 'roster-setup' && (
        <RosterSetup onDone={handleRosterDone} isEdit={false} />
      )}

      {view === 'roster-edit' && (
        <RosterSetup onDone={() => setView('calendar')} isEdit={true} />
      )}

      {view === 'calendar' && (
        <CalendarView onSelectMonth={handleSelectMonth} />
      )}

      {view === 'month' && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div
                className="animate-spin rounded-full h-8 w-8 border-2"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Couldn't load session: {error}
              </p>
              <button className="btn-ghost" onClick={handleBackToCalendar}>
                ← Back to calendar
              </button>
            </div>
          ) : session ? (
            <SessionView
              session={session}
              identity={{ userId, userName }}
              month={activeMonth!}
              onBack={handleBackToCalendar}
            />
          ) : null}
        </>
      )}
    </AppShell>
  )
}
