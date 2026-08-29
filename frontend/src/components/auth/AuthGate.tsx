import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../../store/authStore'
import LoginView from './LoginView'

// Gates the whole app on auth state, mounted above <App/> rather than as an
// early-return inside it. That way App's seed effect and its URL-param
// effect never run while signed out, and everything downstream can assume
// userName is a non-empty string.
export default function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (status === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="animate-spin rounded-full h-8 w-8 border-2"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (status === 'signedOut') {
    return <LoginView />
  }

  return <>{children}</>
}
