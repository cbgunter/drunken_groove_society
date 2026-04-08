import type { ReactNode } from 'react'

interface Props {
  dark: boolean
  onToggleDark: () => void
  onHome: () => void
  children: ReactNode
}

export default function AppShell({ dark, onToggleDark, onHome, children }: Props) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onHome}
          className="flex items-center gap-2 transition-opacity hover:opacity-70"
        >
          <span className="text-xl">🍺</span>
          <span className="font-semibold text-sm tracking-tight">Drunken Groove Society</span>
        </button>
        <button
          onClick={onToggleDark}
          className="text-lg w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Toggle dark mode"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
