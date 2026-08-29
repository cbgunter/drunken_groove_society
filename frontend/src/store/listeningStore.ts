import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NoteRevision, TrackReaction, UserEntryNotes, UserSessionNotes } from '../types'
import { api } from '../api/client'
import { useNotesStore } from './notesStore'
import { resolveNoteRevision, isEmptyRevision } from '../utils/notes'

type DraftValue = string | Record<string, string>
type HydrationStatus = 'loading' | 'done' | 'error'

function draftKey(sessionId: string, entryId: string, field: 'album' | 'tracks') {
  return `${sessionId}:${entryId}:${field}`
}

function entryKey(sessionId: string, entryId: string) {
  return `${sessionId}:${entryId}`
}

// Compares two revisions' content, ignoring savedAt — used to tell whether
// the local draft still matches what this device last saved.
function sameContent(a: NoteRevision, b: NoteRevision): boolean {
  if ((a.albumNotes ?? '') !== (b.albumNotes ?? '')) return false
  if ((a.rating ?? 0) !== (b.rating ?? 0)) return false
  if ((a.pickerNote ?? '') !== (b.pickerNote ?? '')) return false
  const aTracks = a.trackNotes ?? {}
  const bTracks = b.trackNotes ?? {}
  const aTrackKeys = Object.keys(aTracks)
  if (aTrackKeys.length !== Object.keys(bTracks).length) return false
  for (const k of aTrackKeys) if (aTracks[k] !== bTracks[k]) return false
  const aReactions = a.trackReactions ?? {}
  const bReactions = b.trackReactions ?? {}
  const aReactionKeys = Object.keys(aReactions)
  if (aReactionKeys.length !== Object.keys(bReactions).length) return false
  for (const k of aReactionKeys) if (aReactions[k] !== bReactions[k]) return false
  return true
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

  // Cross-device hydration state — deliberately NOT persisted; recomputed
  // from the server every time a session is opened.
  hydrationStatus: Record<string, HydrationStatus> // key: sessionId
  hydrationConflicts: Record<string, NoteRevision> // key: `sessionId:entryId`

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
  saveDraft: (sessionId: string, entryId: string) => Promise<void>

  // Pull this user's saved notes from DynamoDB into local state so they show
  // up on a fresh device. Never overwrites unsaved local edits — those are
  // stashed in hydrationConflicts for the user to resolve.
  hydrateFromServer: (sessionId: string, userId: string, opts?: { force?: boolean }) => Promise<void>
  applyHydrationConflict: (sessionId: string, entryId: string) => void
  dismissHydrationConflict: (sessionId: string, entryId: string) => void
}

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      drafts: {},
      ratings: {},
      reactions: {},
      pickerNotes: {},
      histories: {},
      hydrationStatus: {},
      hydrationConflicts: {},
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

      saveDraft: async (sessionId, entryId) => {
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
          await api.putNotes(sessionId, entryId, {
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

      hydrateFromServer: async (sessionId, userId, opts) => {
        const currentStatus = get().hydrationStatus[sessionId]
        if (currentStatus === 'loading') return
        if (currentStatus === 'done' && !opts?.force) return

        set((s) => ({ hydrationStatus: { ...s.hydrationStatus, [sessionId]: 'loading' } }))

        // Reuses notesStore's 5-minute cache, so opening the meeting view
        // right after this costs zero extra requests.
        await useNotesStore.getState().fetchPeerNotes(sessionId, opts?.force)
        const { peerNotes, peerFetchError } = useNotesStore.getState()

        if (peerFetchError) {
          set((s) => ({ hydrationStatus: { ...s.hydrationStatus, [sessionId]: 'error' } }))
          return
        }

        const mine = peerNotes.find((u) => u.userId === userId)
        if (!mine) {
          set((s) => ({ hydrationStatus: { ...s.hydrationStatus, [sessionId]: 'done' } }))
          return
        }

        const state = get()
        const nextDrafts = { ...state.drafts }
        const nextRatings = { ...state.ratings }
        const nextReactions = { ...state.reactions }
        const nextPickerNotes = { ...state.pickerNotes }
        const nextConflicts = { ...state.hydrationConflicts }

        for (const [entryId, raw] of Object.entries(mine.entries)) {
          const server = resolveNoteRevision(raw)
          if (!server) continue

          const key = entryKey(sessionId, entryId)
          const history = state.histories[key] ?? []
          const localContent: NoteRevision = {
            albumNotes: (state.drafts[draftKey(sessionId, entryId, 'album')] ?? '') as string,
            trackNotes: (state.drafts[draftKey(sessionId, entryId, 'tracks')] ?? {}) as Record<string, string>,
            trackReactions: state.reactions[key],
            pickerNote: state.pickerNotes[key],
            rating: state.ratings[key] ?? 0,
            savedAt: '',
          }

          const localIsEmpty = isEmptyRevision(localContent)
          const matchesLastSave = history.length > 0 && sameContent(history[0], localContent)

          // New-device case (never touched locally), or this device's last
          // save is exactly what's on the server — safe to take the server
          // copy either way. Otherwise there are unsaved local edits: never
          // clobber them, stash the server version for the user to apply.
          const takeServer = (history.length === 0 && localIsEmpty) || matchesLastSave

          if (takeServer) {
            nextDrafts[draftKey(sessionId, entryId, 'album')] = server.albumNotes ?? ''
            nextDrafts[draftKey(sessionId, entryId, 'tracks')] = server.trackNotes ?? {}
            nextRatings[key] = server.rating ?? 0
            if (server.trackReactions) nextReactions[key] = server.trackReactions
            if (server.pickerNote) nextPickerNotes[key] = server.pickerNote
            delete nextConflicts[key]
          } else {
            nextConflicts[key] = server
          }
        }

        set((s) => ({
          drafts: nextDrafts,
          ratings: nextRatings,
          reactions: nextReactions,
          pickerNotes: nextPickerNotes,
          hydrationConflicts: nextConflicts,
          hydrationStatus: { ...s.hydrationStatus, [sessionId]: 'done' },
        }))
      },

      applyHydrationConflict: (sessionId, entryId) => {
        const key = entryKey(sessionId, entryId)
        const server = get().hydrationConflicts[key]
        if (!server) return
        set((s) => {
          const nextConflicts = { ...s.hydrationConflicts }
          delete nextConflicts[key]
          return {
            drafts: {
              ...s.drafts,
              [draftKey(sessionId, entryId, 'album')]: server.albumNotes ?? '',
              [draftKey(sessionId, entryId, 'tracks')]: server.trackNotes ?? {},
            },
            ratings: { ...s.ratings, [key]: server.rating ?? 0 },
            reactions: server.trackReactions ? { ...s.reactions, [key]: server.trackReactions } : s.reactions,
            pickerNotes: server.pickerNote ? { ...s.pickerNotes, [key]: server.pickerNote } : s.pickerNotes,
            hydrationConflicts: nextConflicts,
          }
        })
      },

      dismissHydrationConflict: (sessionId, entryId) => {
        const key = entryKey(sessionId, entryId)
        set((s) => {
          const next = { ...s.hydrationConflicts }
          delete next[key]
          return { hydrationConflicts: next }
        })
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
