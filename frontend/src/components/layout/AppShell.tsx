import type { ReactNode } from 'react'

interface Props {
  onHome: () => void
  userName: string
  onChangeIdentity: () => void
  children: ReactNode
}

export default function AppShell({ onHome, userName, onChangeIdentity, children }: Props) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onHome}
          className="flex items-center gap-3 transition-opacity hover:opacity-70"
        >
          <img src="/logo.jpg" alt="DGS" className="w-7 h-7 rounded-full object-cover" />
          <span className="font-bold text-sm tracking-wide" style={{ letterSpacing: '0.04em' }}>
            Drunken Groove Society
          </span>
        </button>

        <button
          onClick={onChangeIdentity}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: userName ? 'var(--accent-light)' : 'var(--bg-elevated)',
            color: userName ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${userName ? 'var(--accent)' : 'var(--border)'}`,
          }}
          title="Change who you are"
        >
          {userName && (
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {userName[0].toUpperCase()}
            </span>
          )}
          {userName || 'Who are you?'}
        </button>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
