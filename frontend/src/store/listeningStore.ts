import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteRevision, TrackReaction, UserEntryNotes, UserSessionNotes } from '../types'
import { api } from '../api/client'

type DraftValue = string | Record<string, string>

function draftKey(sessionId: string, entryId: string, field: 'album' | 'tracks') {
  return `${sessionId}:${entryId}:${field}`
}

function entryKey(sessionId: string, entryId: string) {
  return `${sessionId}:${entryId}`
}

interface ListeningState {
  // Local drafts: keyed by `sessionId:entryId:field`
  drafts: Record<string, DraftValue>
  // Ratings: keyed by `sessionId:entryId`
  ratings: Record<string, number>
  // Track reactions: keyed by `sessionId:entryId` → track → reaction
  reactions: Record<string, Record<string, TrackReaction>>
  // Picker notes: keyed by `sessionId:entryId`
  pickerNotes: Record<string, string>
  // Note history per entry: keyed by `sessionId:entryId`
  histories: Record<string, NoteRevision[]>

  isSaving: boolean
  saveError: string | null

  // Getters
  getDraft: (sessionId: string, entryId: string, field: 'album' | 'tracks') => DraftValue
  getRating: (sessionId: string, entryId: string) => number
  getHistory: (sessionId: string, entryId: string) => NoteRevision[]
  getTrackReactions: (sessionId: string, entryId: string) => Record<string, TrackReaction>
  getPickerNote: (sessionId: string, entryId: string) => string
  getUserSessionNotes: (sessionId: string, entryIds: string[], userId: string, userName: string) => UserSessionNotes

  // Setters
  setDraft: (sessionId: string, entryId: string, field: 'album' | 'tracks', value: DraftValue) => void
  setRating: (sessionId: string, entryId: string, rating: number) => void
  setTrackReaction: (sessionId: string, entryId: string, track: string, reaction: TrackReaction | null) => void
  setPickerNote: (sessionId: string, entryId: string, note: string) => void

  // Save to DynamoDB (pushes current to history, writes new revision)
  saveDraft: (sessionId: string, entryId: string, userId: string, userName: string) => Promise<void>
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      drafts: {},
      ratings: {},
      reactions: {},
      pickerNotes: {},
      histories: {},
      isSaving: false,
      saveError: null,

      getDraft: (sessionId, entryId, field) =>
        get().drafts[draftKey(sessionId, entryId, field)] ?? (field === 'tracks' ? {} : ''),

      getRating: (sessionId, entryId) =>
        get().ratings[entryKey(sessionId, entryId)] ?? 0,

      getHistory: (sessionId, entryId) =>
        get().histories[entryKey(sessionId, entryId)] ?? [],

      getTrackReactions: (sessionId, entryId) =>
        get().reactions[entryKey(sessionId, entryId)] ?? {},

      getPickerNote: (sessionId, entryId) =>
        get().pickerNotes[entryKey(sessionId, entryId)] ?? '',

      getUserSessionNotes: (sessionId, entryIds, userId, userName): UserSessionNotes => {
        const { drafts, ratings, reactions, pickerNotes, histories } = get()
        const entries: Record<string, UserEntryNotes> = {}
        for (const entryId of entryIds) {
          const albumNotes = (drafts[draftKey(sessionId, entryId, 'album')] ?? '') as string
          const trackNotes = (drafts[draftKey(sessionId, entryId, 'tracks')] ?? {}) as Record<string, string>
          const trackReactions = reactions[entryKey(sessionId, entryId)]
          const pickerNote = pickerNotes[entryKey(sessionId, entryId)]
          const rating = ratings[entryKey(sessionId, entryId)] ?? 0
          const history = histories[entryKey(sessionId, entryId)] ?? []
          entries[entryId] = {
            entryId,
            current: {
              albumNotes,
              trackNotes,
              ...(trackReactions ? { trackReactions } : {}),
              ...(pickerNote ? { pickerNote } : {}),
              rating,
              savedAt: new Date().toISOString(),
            },
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
          ratings: { ...s.ratings, [entryKey(sessionId, entryId)]: rating },
        })),

      setTrackReaction: (sessionId, entryId, track, reaction) =>
        set((s) => {
          const key = entryKey(sessionId, entryId)
          const prev = s.reactions[key] ?? {}
          const next = { ...prev }
          if (reaction === null) {
            delete next[track]
          } else {
            next[track] = reaction
          }
          return { reactions: { ...s.reactions, [key]: next } }
        }),

      setPickerNote: (sessionId, entryId, note) =>
        set((s) => ({
          pickerNotes: { ...s.pickerNotes, [entryKey(sessionId, entryId)]: note },
        })),

      saveDraft: async (sessionId, entryId, userId, userName) => {
        const state = get()
        const albumNotes = (state.drafts[draftKey(sessionId, entryId, 'album')] ?? '') as string
        const trackNotes = (state.drafts[draftKey(sessionId, entryId, 'tracks')] ?? {}) as Record<string, string>
        const trackReactions = state.reactions[entryKey(sessionId, entryId)]
        const pickerNote = state.pickerNotes[entryKey(sessionId, entryId)]
        const rating = state.ratings[entryKey(sessionId, entryId)] ?? 0
        const histKey = entryKey(sessionId, entryId)
        const prevHistory = state.histories[histKey] ?? []

        const revision: NoteRevision = {
          albumNotes,
          trackNotes,
          ...(trackReactions ? { trackReactions } : {}),
          ...(pickerNote ? { pickerNote } : {}),
          rating,
          savedAt: new Date().toISOString(),
        }

        const nextHistory = [revision, ...prevHistory].slice(0, 10)

        set({ isSaving: true, saveError: null })
        try {
          await api.putNotes(sessionId, userId, userName, entryId, {
            albumNotes,
            trackNotes,
            rating,
            ...(trackReactions ? { trackReactions } : {}),
            ...(pickerNote ? { pickerNote } : {}),
          })
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
      partialize: (s) => ({
        drafts: s.drafts,
        ratings: s.ratings,
        reactions: s.reactions,
        pickerNotes: s.pickerNotes,
        histories: s.histories,
      }),
    },
  ),
)
