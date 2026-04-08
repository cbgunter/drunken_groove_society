import { useState } from 'react'
import { renderMarkdown } from '../../utils/markdown'

interface Props {
  label: string
  content: string
}

export default function RichTextBlock({ label, content }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!content.trim()) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-left"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>{label}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && (
        <div
          className="px-3 py-3 text-sm leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </div>
  )
}
