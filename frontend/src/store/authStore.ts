import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as cognito from '../api/cognito'
import type { TokenSet } from '../api/cognito'
import { registerAuthHooks } from '../api/client'
import { useListeningStore } from './listeningStore'
import { useNotesStore } from './notesStore'

const REFRESH_MARGIN_MS = 2 * 60 * 1000 // refresh if less than 2 min from expiry

type AuthStatus = 'unknown' | 'signedOut' | 'signedIn'

interface Challenge {
  session: string
  username: string
}

interface AuthState {
  status: AuthStatus
  tokens: TokenSet | null
  userId: string | null
  userName: string | null
  challenge: Challenge | null
  error: string | null
  isSubmitting: boolean

  bootstrap: () => Promise<void>
  signIn: (username: string, password: string) => Promise<void>
  submitNewPassword: (newPassword: string) => Promise<void>
  signOut: () => void
  clearError: () => void
  getValidIdToken: () => Promise<string | null>
  forceRefresh: () => Promise<string | null>
}

// Dedupe concurrent refreshes — React StrictMode double-invokes effects in
// dev (so bootstrap runs twice), and several concurrent API calls would
// otherwise race to persist different token sets.
let inflightRefresh: Promise<string | null> | null = null

// Two identities can share a browser (dev/testing, or a shared device).
// listeningStore/notesStore key their persisted drafts by sessionId:entryId
// only, with no user component, so switching identity must clear them —
// otherwise the new user's next save would silently include the previous
// user's unsaved drafts. Anything already saved comes right back via
// listeningStore.hydrateFromServer, so this only costs unsaved local state.
function resetLocalStoresIfUserChanged(sub: string) {
  const prev = localStorage.getItem('dgs_last_user')
  if (prev && prev !== sub) {
    localStorage.removeItem('dgs-listening')
    localStorage.removeItem('dgs-notes')
    useListeningStore.setState({
      drafts: {},
      ratings: {},
      reactions: {},
      pickerNotes: {},
      histories: {},
      hydrationStatus: {},
      hydrationConflicts: {},
    })
    useNotesStore.setState({
      drafts: {},
      submitted: {},
      peerNotes: [],
      peerNotesFetchedFor: null,
    })
  }
  localStorage.setItem('dgs_last_user', sub)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: 'unknown',
      tokens: null,
      userId: null,
      userName: null,
      challenge: null,
      error: null,
      isSubmitting: false,

      bootstrap: async () => {
        const { tokens } = get()
        if (!tokens) {
          set({ status: 'signedOut' })
          return
        }
        if (tokens.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
          const claims = cognito.decodeIdToken(tokens.idToken)
          resetLocalStoresIfUserChanged(claims.sub)
          set({ status: 'signedIn', userId: claims.sub, userName: claims.name })
          return
        }
        const fresh = await get().forceRefresh()
        if (!fresh) set({ status: 'signedOut' })
      },

      signIn: async (username, password) => {
        set({ isSubmitting: true, error: null })
        try {
          const result = await cognito.login(username, password)
          if (result.kind === 'newPasswordRequired') {
            set({ isSubmitting: false, challenge: { session: result.session, username: result.username } })
            return
          }
          const claims = cognito.decodeIdToken(result.tokens.idToken)
          resetLocalStoresIfUserChanged(claims.sub)
          set({
            isSubmitting: false,
            tokens: result.tokens,
            status: 'signedIn',
            userId: claims.sub,
            userName: claims.name,
            challenge: null,
          })
        } catch (err) {
          set({ isSubmitting: false, error: (err as Error).message })
          throw err
        }
      },

      submitNewPassword: async (newPassword) => {
        const { challenge } = get()
        if (!challenge) throw new Error('No sign-in in progress.')
        set({ isSubmitting: true, error: null })
        try {
          const tokens = await cognito.completeNewPassword(challenge.username, newPassword, challenge.session)
          const claims = cognito.decodeIdToken(tokens.idToken)
          resetLocalStoresIfUserChanged(claims.sub)
          set({
            isSubmitting: false,
            tokens,
            status: 'signedIn',
            userId: claims.sub,
            userName: claims.name,
            challenge: null,
          })
        } catch (err) {
          set({ isSubmitting: false, error: (err as Error).message })
          throw err
        }
      },

      signOut: () => {
        set({ status: 'signedOut', tokens: null, userId: null, userName: null, challenge: null, error: null })
      },

      clearError: () => set({ error: null }),

      getValidIdToken: async () => {
        const { tokens } = get()
        if (!tokens) return null
        if (tokens.expiresAt > Date.now() + REFRESH_MARGIN_MS) return tokens.idToken
        return get().forceRefresh()
      },

      forceRefresh: async () => {
        const { tokens } = get()
        if (!tokens?.refreshToken) return null
        if (inflightRefresh) return inflightRefresh
        inflightRefresh = (async () => {
          try {
            const fresh = await cognito.refreshTokens(tokens.refreshToken)
            const claims = cognito.decodeIdToken(fresh.idToken)
            set({ tokens: fresh, status: 'signedIn', userId: claims.sub, userName: claims.name })
            return fresh.idToken
          } catch {
            set({ status: 'signedOut', tokens: null, userId: null, userName: null })
            return null
          } finally {
            inflightRefresh = null
          }
        })()
        return inflightRefresh
      },
    }),
    {
      name: 'dgs-auth',
      // Persist tokens only — userId/userName are always re-derived from the
      // ID token on bootstrap, so a stale-claim mismatch can't happen.
      partialize: (s) => ({ tokens: s.tokens }),
    },
  ),
)

registerAuthHooks({
  getValidIdToken: () => useAuthStore.getState().getValidIdToken(),
  forceRefresh: () => useAuthStore.getState().forceRefresh(),
  signOut: () => useAuthStore.getState().signOut(),
})
