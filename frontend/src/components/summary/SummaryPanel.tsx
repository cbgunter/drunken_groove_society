import { useState } from 'react'
import type { Session } from '../../types'
import { useNotesStore } from '../../store/notesStore'
import { api } from '../../api/client'
import { renderMarkdown } from '../../utils/markdown'

interface Props {
  session: Session
  locked: boolean
  onGenerated: () => void
}

export default function SummaryPanel({ session, locked, onGenerated }: Props) {
  const { fetchPeerNotes, peerNotes } = useNotesStore()
  const [summary, setSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setIsLoading(true)
    setError('')
    setSummary('')

    try {
      // Fetch latest notes first
      await fetchPeerNotes(session.id)

      const result = await api.generateSummary({
        session,
        allNotes: peerNotes,
      })
      setSummary(result.summary)
      if (!locked) onGenerated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="mt-3 rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Meeting guide</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Talking points, note highlights, and discussion questions from all shared notes
          </p>
        </div>
        <button
          className="btn-primary text-sm"
          onClick={handleGenerate}
          disabled={isLoading}
        >
          {isLoading ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          {error === 'Summary unavailable — API key not configured'
            ? 'Summary feature coming soon — API key not yet configured.'
            : `Error: ${error}`}
        </p>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
          <div
            className="animate-spin rounded-full h-4 w-4 border-2"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm">Thinking…</span>
        </div>
      )}

      {summary && !isLoading && (
        <div>
          <div
            className="rounded-lg px-4 py-3 text-sm leading-relaxed mb-3"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
          />
          <button className="btn-ghost text-xs" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '📋 Copy to clipboard'}
          </button>
        </div>
      )}
    </div>
  )
}
