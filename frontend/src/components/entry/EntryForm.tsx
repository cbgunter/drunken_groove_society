import type { Entry, EntryFormat } from '../../types'

const FORMATS: EntryFormat[] = ['LP', 'EP', 'Single', 'Live', 'Compilation', 'Other']
const EMOJI_SUGGESTIONS: Record<string, string> = {
  LP: '💿', EP: '🎵', Single: '🎤', Live: '🎸', Compilation: '📀', Other: '🎶',
}

interface Props {
  entry: Entry
  onChange: (updates: Partial<Entry>) => void
  onDone: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors'
const inputStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
}

export default function EntryForm({ entry, onChange, onDone }: Props) {
  function set<K extends keyof Entry>(key: K, value: Entry[K]) {
    onChange({ [key]: value } as Partial<Entry>)
  }

  return (
    <div className="space-y-4">
      <Field label="Selected by">
        <input
          className={inputCls}
          style={inputStyle}
          placeholder="e.g. Marcus"
          value={entry.selector}
          onChange={(e) => set('selector', e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-[56px_1fr] gap-3">
        <Field label="Badge">
          <input
            className={inputCls + ' text-center text-2xl'}
            style={inputStyle}
            value={entry.badge_emoji}
            onChange={(e) => set('badge_emoji', e.target.value)}
            maxLength={4}
          />
        </Field>
        <Field label="Artist">
          <input
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Miles Davis"
            value={entry.artist}
            onChange={(e) => set('artist', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_80px_130px] gap-3">
        <Field label="Album / Performance title">
          <input
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Kind of Blue"
            value={entry.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="Year">
          <input
            className={inputCls}
            style={inputStyle}
            type="number"
            min={1900}
            max={2099}
            value={entry.year}
            onChange={(e) => set('year', Number(e.target.value))}
          />
        </Field>
        <Field label="Format">
          <select
            className={inputCls}
            style={inputStyle}
            value={entry.format}
            onChange={(e) => {
              const f = e.target.value as EntryFormat
              set('format', f)
              if (!entry.badge_emoji || entry.badge_emoji === '🎵') {
                set('badge_emoji', EMOJI_SUGGESTIONS[f] ?? '🎵')
              }
            }}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Genre tags (comma-separated, max 4)">
        <input
          className={inputCls}
          style={inputStyle}
          placeholder="e.g. Modal Jazz, First Takes"
          value={entry.genre_tags.join(', ')}
          onChange={(e) =>
            set(
              'genre_tags',
              e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 4),
            )
          }
        />
      </Field>

      <Field label="About the band">
        <textarea
          className={inputCls + ' resize-y min-h-[80px]'}
          style={inputStyle}
          placeholder="Band history, lineup, context…"
          value={entry.about_band}
          onChange={(e) => set('about_band', e.target.value)}
        />
      </Field>

      <Field label="About the album / performance">
        <textarea
          className={inputCls + ' resize-y min-h-[80px]'}
          style={inputStyle}
          placeholder="Recording context, themes, why it matters…"
          value={entry.about_album}
          onChange={(e) => set('about_album', e.target.value)}
        />
      </Field>

      <Field label="Fun facts (one per line)">
        <textarea
          className={inputCls + ' resize-y min-h-[72px]'}
          style={inputStyle}
          placeholder="Recorded in one take&#10;Bass player was 19&#10;…"
          value={entry.fun_facts.join('\n')}
          onChange={(e) =>
            set(
              'fun_facts',
              e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
            )
          }
        />
      </Field>

      <Field label="Tracklist (one track per line)">
        <textarea
          className={inputCls + ' resize-y min-h-[96px]'}
          style={inputStyle}
          placeholder="So What&#10;Freddie Freeloader&#10;Blue in Green&#10;…"
          value={entry.tracklist.join('\n')}
          onChange={(e) =>
            set(
              'tracklist',
              e.target.value.split('\n').map((l) => l.trim()).filter(Boolean),
            )
          }
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="External link label">
          <input
            className={inputCls}
            style={inputStyle}
            placeholder="e.g. Watch on YouTube"
            value={entry.external_link?.label ?? ''}
            onChange={(e) =>
              set('external_link', e.target.value
                ? { label: e.target.value, url: entry.external_link?.url ?? '' }
                : undefined)
            }
          />
        </Field>
        <Field label="External link URL">
          <input
            className={inputCls}
            style={inputStyle}
            placeholder="https://…"
            value={entry.external_link?.url ?? ''}
            onChange={(e) =>
              set('external_link', e.target.value
                ? { label: entry.external_link?.label ?? 'Link', url: e.target.value }
                : undefined)
            }
          />
        </Field>
      </div>

      <button className="btn-primary" onClick={onDone}>
        Done editing
      </button>
    </div>
  )
}
