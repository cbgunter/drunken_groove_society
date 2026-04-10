import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '../types'

export type SessionStatus = 'empty' | 'picking' | 'listening' | 'done'

export interface MonthPick {
  selector: string
  artist: string
  title: string
}

export interface MonthSummary {
  status: SessionStatus
  picks: MonthPick[]
  overallRatings?: Record<string, number> // entryId → combined avg rating (1-5)
}

export interface CalendarState {
  roster: [string, string, string] | null
  summaries: Record<string, MonthSummary>   // keyed by YYYY-MM
  localSessions: Record<string, Session>    // seed/draft sessions not yet in DynamoDB
  seedVersion: number                        // bumped when seed data changes

  setRoster: (members: [string, string, string]) => void
  updateMonthSummary: (month: string, summary: MonthSummary) => void
  getMonthSummary: (month: string) => MonthSummary
  putLocalSession: (session: Session) => void
  getLocalSession: (month: string) => Session | null
  removeLocalSession: (month: string) => void
  markSeeded: (version: number) => void
}

const EMPTY_SUMMARY: MonthSummary = { status: 'empty', picks: [] }

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      roster: null,
      summaries: {},
      localSessions: {},
      seedVersion: 0,

      setRoster: (members) => set({ roster: members }),

      updateMonthSummary: (month, summary) =>
        set((s) => ({ summaries: { ...s.summaries, [month]: summary } })),

      getMonthSummary: (month) => get().summaries[month] ?? EMPTY_SUMMARY,

      putLocalSession: (session) =>
        set((s) => ({
          localSessions: { ...s.localSessions, [session.month]: session },
        })),

      getLocalSession: (month) => get().localSessions[month] ?? null,

      // Once a session is saved to DynamoDB, remove it from local cache
      removeLocalSession: (month) =>
        set((s) => {
          const next = { ...s.localSessions }
          delete next[month]
          return { localSessions: next }
        }),

      markSeeded: (version) => set({ seedVersion: version }),
    }),
    { name: 'dgs-calendar' },
  ),
)

// Generate the 13-month range: Dec 2025 → Dec 2026
export function getCalendarMonths(): string[] {
  const months: string[] = []
  const start = new Date(2025, 11, 1) // Dec 2025
  const end = new Date(2026, 11, 1)   // Dec 2026
  const cur = new Date(start)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    months.push(`${y}-${m}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

export function formatMonthLabel(month: string): { short: string; long: string } {
  const [year, mon] = month.split('-')
  const date = new Date(Number(year), Number(mon) - 1, 1)
  return {
    short: date.toLocaleString('default', { month: 'short' }),
    long: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
  }
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
