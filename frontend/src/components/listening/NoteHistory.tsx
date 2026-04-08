import { useState } from 'react'
import type { NoteRevision } from '../../types'

interface Props {
  history: NoteRevision[]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function NoteHistory({ history }: Props) {
  const [open, setOpen] = useState(false)

  if (!history.length) return null

  return (
    <div>
      <button
        className="text-xs flex items-center gap-1"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▲' : '▼'} {history.length} previous save{history.length > 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {history.map((rev, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                opacity: 0.8,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {timeAgo(rev.savedAt)}
                </span>
                {rev.rating > 0 && (
                  <span className="text-xs">
                    {'🎵'.repeat(rev.rating)} {rev.rating}/5
                  </span>
                )}
              </div>
              {rev.albumNotes && (
                <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {rev.albumNotes}
                </p>
              )}
              {Object.entries(rev.trackNotes).map(([track, note]) =>
                note ? (
                  <div key={track} className="mt-1">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
                      {track}:{' '}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{note}</span>
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
