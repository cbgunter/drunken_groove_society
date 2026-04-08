import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserSessionNotes } from '../types'
import { api } from '../api/client'

function draftKey(sessionId: string, entryId: string) {
  return `${sessionId}:${entryId}`
}

interface NotesState {
  // Local drafts — private until submitted
  drafts: Record<string, string> // key: `${sessionId}:${entryId}`
  // Which sessions have been submitted
  submitted: Record<string, boolean> // key: sessionId
  // All submitted notes fetched from API (all users)
  peerNotes: UserSessionNotes[]
  isFetchingPeers: boolean
  isSubmitting: boolean
  submitError: string | null

  getDraft: (sessionId: string, entryId: string) => string
  setDraft: (sessionId: string, entryId: string, content: string) => void
  hasSubmitted: (sessionId: string) => boolean
  submitNotes: (
    sessionId: string,
    userId: string,
    userName: string,
    entryIds: string[],
  ) => Promise<void>
  fetchPeerNotes: (sessionId: string) => Promise<void>
  clearSubmitError: () => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      drafts: {},
      submitted: {},
      peerNotes: [],
      isFetchingPeers: false,
      isSubmitting: false,
      submitError: null,

      getDraft: (sessionId, entryId) =>
        get().drafts[draftKey(sessionId, entryId)] ?? '',

      setDraft: (sessionId, entryId, content) =>
        set((s) => ({
          drafts: { ...s.drafts, [draftKey(sessionId, entryId)]: content },
        })),

      hasSubmitted: (sessionId) => get().submitted[sessionId] === true,

      submitNotes: async (_sessionId, _userId, _userName, _entryIds) => {
        // Deprecated — notes are now saved per-entry via listeningStore.saveDraft
      },

      fetchPeerNotes: async (sessionId) => {
        set({ isFetchingPeers: true })
        try {
          const data = await api.getNotes(sessionId)
          set({ peerNotes: data.users, isFetchingPeers: false })
        } catch {
          set({ isFetchingPeers: false })
        }
      },

      clearSubmitError: () => set({ submitError: null }),
    }),
    {
      name: 'dgs-notes',
      // Only persist drafts and submitted status, not peer notes or loading flags
      partialize: (s) => ({ drafts: s.drafts, submitted: s.submitted }),
    },
  ),
)
