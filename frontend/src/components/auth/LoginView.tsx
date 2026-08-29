import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'

const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="text-xs px-3 py-2 rounded-lg"
      style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
    >
      {message}
    </div>
  )
}

export default function LoginView() {
  const challenge = useAuthStore((s) => s.challenge)
  const error = useAuthStore((s) => s.error)
  const isSubmitting = useAuthStore((s) => s.isSubmitting)
  const signIn = useAuthStore((s) => s.signIn)
  const submitNewPassword = useAuthStore((s) => s.submitNewPassword)
  const clearError = useAuthStore((s) => s.clearError)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    clearError()
    setLocalError('')
    try {
      await signIn(username, password)
    } catch {
      // surfaced via the store's `error`
    }
  }

  async function handleNewPassword(e: FormEvent) {
    e.preventDefault()
    clearError()
    if (newPassword.length < 12) {
      setLocalError('Password must be at least 12 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.')
      return
    }
    setLocalError('')
    try {
      await submitNewPassword(newPassword)
    } catch {
      // surfaced via the store's `error`
    }
  }

  const shownError = localError || error

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-8 px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="text-center flex flex-col items-center gap-2">
        <img src="/logo.jpg" alt="DGS" className="w-16 h-16 rounded-full object-cover" />
        <h1 className="text-2xl font-bold">Drunken Groove Society</h1>
      </div>

      <div
        className="w-full max-w-sm rounded-xl p-6 space-y-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {challenge ? (
          <form className="space-y-4" onSubmit={handleNewPassword}>
            <div>
              <h2 className="text-base font-semibold">Choose a password</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                First time signing in as {challenge.username} — set a permanent password.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
                autoFocus
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            {shownError && <ErrorBanner message={shownError} />}
            <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Set password & sign in'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleSignIn}>
            <div>
              <h2 className="text-base font-semibold">Sign in</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Use your crew name and password.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
                autoFocus
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            {shownError && <ErrorBanner message={shownError} />}
            <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
