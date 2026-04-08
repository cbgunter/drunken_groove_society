import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteRevision, UserEntryNotes, UserSessionNotes } from '../types'
import { api } from '../api/client'

type DraftValue = string | Record<string, string>

function draftKey(sessionId: string, entryId: string, field: 'album' | 'tracks') {
  return `${sessionId}:${entryId}:${field}`
}

interface ListeningState {
  // Local drafts: keyed by `sessionId:entryId:field`
  drafts: Record<string, DraftValue>
  // Ratings: keyed by `sessionId:entryId`
  ratings: Record<string, number>
  // Note history per entry: keyed by `sessionId:entryId`
  histories: Record<string, NoteRevision[]>

  isSaving: boolean
  saveError: string | null

  // Getters
  getDraft: (sessionId: string, entryId: string, field: 'album' | 'tracks') => DraftValue
  getRating: (sessionId: string, entryId: string) => number
  getHistory: (sessionId: string, entryId: string) => NoteRevision[]
  getUserSessionNotes: (sessionId: string, entryIds: string[], userId: string, userName: string) => UserSessionNotes

  // Setters
  setDraft: (sessionId: string, entryId: string, field: 'album' | 'tracks', value: DraftValue) => void
  setRating: (sessionId: string, entryId: string, rating: number) => void

  // Save to DynamoDB (pushes current to history, writes new revision)
  saveDraft: (sessionId: string, entryId: string, userId: string, userName: string) => Promise<void>
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      drafts: {},
      ratings: {},
      histories: {},
      isSaving: false,
      saveError: null,

      getDraft: (sessionId, entryId, field) =>
        get().drafts[draftKey(sessionId, entryId, field)] ?? (field === 'tracks' ? {} : ''),

      getRating: (sessionId, entryId) =>
        get().ratings[`${sessionId}:${entryId}`] ?? 0,

      getHistory: (sessionId, entryId) =>
        get().histories[`${sessionId}:${entryId}`] ?? [],

      getUserSessionNotes: (sessionId, entryIds, userId, userName): UserSessionNotes => {
        const { drafts, ratings, histories } = get()
        const entries: Record<string, UserEntryNotes> = {}
        for (const entryId of entryIds) {
          const albumNotes = (drafts[draftKey(sessionId, entryId, 'album')] ?? '') as string
          const trackNotes = (drafts[draftKey(sessionId, entryId, 'tracks')] ?? {}) as Record<string, string>
          const rating = ratings[`${sessionId}:${entryId}`] ?? 0
          const history = histories[`${sessionId}:${entryId}`] ?? []
          entries[entryId] = {
            entryId,
            current: { albumNotes, trackNotes, rating, savedAt: new Date().toISOString() },
            history,
          }
        }
        return { userId, userName, entries, updatedAt: new Date().toISOString() }
      },

      setDraft: (sessionId, entryId, field, value) =>
        set((s) => ({
          drafts: { ...s.drafts, [draftKey(sessionId, entryId, field)]: value },
        })),

      setRating: (sessionId, entryId, rating) =>
        set((s) => ({
          ratings: { ...s.ratings, [`${sessionId}:${entryId}`]: rating },
        })),

      saveDraft: async (sessionId, entryId, userId, userName) => {
        const state = get()
        const albumNotes = (state.drafts[draftKey(sessionId, entryId, 'album')] ?? '') as string
        const trackNotes = (state.drafts[draftKey(sessionId, entryId, 'tracks')] ?? {}) as Record<string, string>
        const rating = state.ratings[`${sessionId}:${entryId}`] ?? 0
        const histKey = `${sessionId}:${entryId}`
        const prevHistory = state.histories[histKey] ?? []

        const revision: NoteRevision = {
          albumNotes,
          trackNotes,
          rating,
          savedAt: new Date().toISOString(),
        }

        // Push current to history (keep last 10)
        const nextHistory = [revision, ...prevHistory].slice(0, 10)

        set({ isSaving: true, saveError: null })
        try {
          await api.putNotes(sessionId, userId, userName, entryId, { albumNotes, trackNotes, rating })
          set((s) => ({
            histories: { ...s.histories, [histKey]: nextHistory },
            isSaving: false,
          }))
        } catch (err) {
          set({ isSaving: false, saveError: (err as Error).message })
          throw err
        }
      },
    }),
    {
      name: 'dgs-listening',
      partialize: (s) => ({ drafts: s.drafts, ratings: s.ratings, histories: s.histories }),
    },
  ),
)
