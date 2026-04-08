import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { useSessionStore } from './store/sessionStore'
import { useCalendarStore } from './store/calendarStore'
import AppShell from './components/layout/AppShell'
import CalendarView from './components/calendar/CalendarView'
import SessionView from './components/session/SessionView'
import RosterSetup from './components/roster/RosterSetup'
import { HISTORIC_SESSIONS, HISTORIC_ROSTER } from './utils/historicSeed'

function getOrCreateUserId(): string {
  let id = localStorage.getItem('dgs_user_id')
  if (!id) {
    id = nanoid(10)
    localStorage.setItem('dgs_user_id', id)
  }
  return id
}

function getUserName(): string {
  return localStorage.getItem('dgs_user_name') ?? ''
}

type View = 'calendar' | 'month' | 'roster-setup' | 'roster-edit'

export default function App() {
  const { session, isLoading, error, loadOrCreateForMonth } = useSessionStore()
  const { roster, seeded, setRoster, putLocalSession, updateMonthSummary, markSeeded } =
    useCalendarStore()

  const [view, setView] = useState<View>('calendar')
  const [activeMonth, setActiveMonth] = useState<string | null>(null)
  const [userId] = useState(getOrCreateUserId)
  const [userName, setUserName] = useState(getUserName)

  // Dark mode
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('dgs_theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('dgs_theme', dark ? 'dark' : 'light')
  }, [dark])

  // One-time seed of historic data
  useEffect(() => {
    if (seeded) return
    // Set roster from historic data if not already configured
    if (!roster) setRoster(HISTORIC_ROSTER)
    // Populate local session cache + calendar summaries
    for (const session of HISTORIC_SESSIONS) {
      putLocalSession(session)
      updateMonthSummary(session.month, {
        status: session.locked ? 'done' : 'picking',
        picks: session.entries.map((e) => ({
          selector: e.selector,
          artist: e.artist,
          title: e.title,
        })),
        overallRatings: session.overallRatings,
      })
    }
    markSeeded()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL param on initial load (deep-link to a month)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const month = params.get('month')
    if (month && /^\d{4}-\d{2}$/.test(month)) {
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

  // User name prompt (one-time, inline in name-aware stores)
  const [showNamePrompt, setShowNamePrompt] = useState(!userName)
  const [nameInput, setNameInput] = useState('')

  function saveName() {
    const name = nameInput.trim() || 'Anonymous'
    localStorage.setItem('dgs_user_name', name)
    setUserName(name)
    setShowNamePrompt(false)
  }

  return (
    <AppShell dark={dark} onToggleDark={() => setDark((d) => !d)} onHome={handleBackToCalendar}>
      {/* Name prompt */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-xl p-6 shadow-xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-semibold mb-1">What's your name?</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Shows next to your notes when you share them.
            </p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Marcus"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              className="w-full rounded-lg px-3 py-2 text-sm mb-4 outline-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            <button className="btn-primary w-full justify-center" onClick={saveName}>
              Continue
            </button>
          </div>
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
