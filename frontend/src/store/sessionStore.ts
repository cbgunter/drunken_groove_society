import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Session, Entry, EntryFormat } from '../types'
import { api } from '../api/client'
import { useCalendarStore } from './calendarStore'

function monthToTitle(month: string): string {
  const [year, mon] = month.split('-')
  const date = new Date(Number(year), Number(mon) - 1, 1)
  return date.toLocaleString('default', { month: 'long', year: 'numeric' }) + ' — Listening Session'
}

function blankEntry(selector = ''): Entry {
  return {
    id: nanoid(10),
    selector,
    artist: '',
    title: '',
    year: new Date().getFullYear(),
    format: 'LP' as EntryFormat,
    genre_tags: [],
    badge_emoji: '🎵',
    about_band: '',
    about_album: '',
    fun_facts: [],
    tracklist: [],
    external_link: undefined,
  }
}

function blankSessionForMonth(month: string, roster: string[]): Session {
  const now = new Date().toISOString()
  const [year, mon] = month.split('-')
  const date = `${year}-${mon}-01`
  return {
    id: month,
    month,
    title: monthToTitle(month),
    date,
    entries: roster.map((name) => blankEntry(name)),
    phase: 'selection',
    locked: false,
    createdAt: now,
    updatedAt: now,
  }
}

interface SessionState {
  session: Session | null
  activeEntryId: string | null
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  error: string | null

  setActiveEntry: (id: string) => void
  updateSession: (updates: Partial<Pick<Session, 'title' | 'date'>>) => void
  updateEntry: (id: string, updates: Partial<Entry>) => void
  lockSession: (overallRatings?: Record<string, number>) => void
  loadOrCreateForMonth: (month: string, roster: string[]) => Promise<void>
  saveToRemote: () => Promise<string>
  clearError: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  activeEntryId: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  error: null,

  setActiveEntry: (id) => set({ activeEntryId: id }),

  updateSession: (updates) => {
    const { session } = get()
    if (!session) return
    set({
      session: { ...session, ...updates, updatedAt: new Date().toISOString() },
      isDirty: true,
    })
  },

  updateEntry: (id, updates) => {
    const { session } = get()
    if (!session) return
    set({
      session: {
        ...session,
        entries: session.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    })
  },

  lockSession: (overallRatings?: Record<string, number>) => {
    const { session } = get()
    if (!session) return
    set({
      session: {
        ...session,
        locked: true,
        phase: 'done',
        overallRatings: overallRatings ?? session.overallRatings,
        updatedAt: new Date().toISOString(),
      },
    })
  },

  loadOrCreateForMonth: async (month, roster) => {
    set({ isLoading: true, error: null, session: null })

    // 1. Check local cache first (seed data / unsaved drafts) — no API call needed
    const cal = useCalendarStore.getState()
    const local = cal.getLocalSession(month)
    if (local) {
      set({
        session: local,
        activeEntryId: local.entries[0]?.id ?? null,
        isLoading: false,
        isDirty: false,
      })
      return
    }

    // 2. Try to load from DynamoDB
    try {
      const session = await api.getSession(month)
      set({
        session,
        activeEntryId: session.entries[0]?.id ?? null,
        isLoading: false,
        isDirty: false,
      })
    } catch {
      // 3. Not in DynamoDB yet — start a blank local session
      const session = blankSessionForMonth(month, roster)
      set({
        session,
        activeEntryId: session.entries[0]?.id ?? null,
        isLoading: false,
        isDirty: false,
      })
    }
  },

  saveToRemote: async () => {
    const { session } = get()
    if (!session) throw new Error('No session to save')
    set({ isSaving: true, error: null })
    try {
      await api.putSession(session)
      // Promote from local cache to DynamoDB — no longer need local copy
      useCalendarStore.getState().removeLocalSession(session.month)
      set({ isSaving: false, isDirty: false })
      return session.id
    } catch (err) {
      set({ isSaving: false, error: (err as Error).message })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))
