import type { Entry } from '../../types'

interface Props {
  entry: Entry
}

const FORMAT_LABELS: Record<string, string> = {
  LP: 'LP',
  EP: 'EP',
  Single: 'Single',
  Live: 'Live',
  Compilation: 'Compilation',
  Other: '',
}

export default function EntryMeta({ entry }: Props) {
  return (
    <div className="flex gap-4 items-start">
      <div className="text-4xl flex-shrink-0 leading-none pt-1">{entry.badge_emoji}</div>
      <div className="flex-1 min-w-0">
        {entry.selector && (
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
            {entry.selector}'s pick
          </p>
        )}
        <h2 className="text-lg font-bold leading-tight truncate">
          {entry.artist || <span style={{ color: 'var(--text-muted)' }}>Artist</span>}
        </h2>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {entry.title || <span style={{ color: 'var(--text-muted)' }}>Title</span>}
          {entry.year ? ` · ${entry.year}` : ''}
          {entry.format && entry.format !== 'Other' ? ` · ${FORMAT_LABELS[entry.format]}` : ''}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {entry.genre_tags.map((tag) => (
            <span key={tag} className="pill">{tag}</span>
          ))}
        </div>
        {entry.external_link && (
          <a
            href={entry.external_link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs px-2.5 py-1 rounded-lg"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--accent)',
              background: 'var(--accent-light)',
            }}
          >
            ▶ {entry.external_link.label}
          </a>
        )}
      </div>
    </div>
  )
}
