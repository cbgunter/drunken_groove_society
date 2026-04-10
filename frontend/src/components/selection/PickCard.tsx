import { useState } from 'react'
import type { Entry, LookupResult } from '../../types'
import { api } from '../../api/client'

interface Props {
  entry: Entry
  onChange: (updates: Partial<Entry>) => void
  onSave: () => void
  isSaving: boolean
}

export default function PickCard({ entry, onChange, onSave, isSaving }: Props) {
  const [artist, setArtist] = useState(entry.artist)
  const [album, setAlbum] = useState(entry.title)
  const [isLooking, setIsLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [looked, setLooked] = useState(entry.tracklist.length > 0)

  const inputStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  async function handleLookup() {
    if (!artist.trim() || !album.trim()) return
    setIsLooking(true)
    setLookupError('')
    // Commit the typed values first
    onChange({ artist: artist.trim(), title: album.trim() })
    try {
      const result: LookupResult = await api.lookupAlbum({ artist: artist.trim(), album: album.trim() })
      onChange({
        artist: artist.trim(),
        title: album.trim(),
        about_band:   result.about_band,
        about_album:  result.about_album,
        genre_tags:   result.genre_tags,
        year:         result.year,
        format:       result.format,
        fun_facts:    result.fun_facts,
        tracklist:    result.tracklist,
        external_link: result.external_link,
        badge_emoji:  entry.badge_emoji,
      })
      setLooked(true)
    } catch (e) {
      setLookupError((e as Error).message)
      // Still save the artist/title so the pick isn't lost
      onChange({ artist: artist.trim(), title: album.trim() })
    } finally {
      setIsLooking(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: looked ? 'var(--accent-light)' : 'var(--bg-surface)',
        border: `1.5px solid ${looked ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      {/* Selector header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{entry.badge_emoji}</span>
        <span className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>
          {entry.selector}'s pick
        </span>
        {looked && (
          <span
            className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            ✓ Looked up
          </span>
        )}
      </div>

      {/* Artist / album inputs */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Band / Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Album title"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      {/* Lookup result preview */}
      {looked && entry.genre_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.genre_tags.map((t) => (
            <span key={t} className="pill text-[10px]">{t}</span>
          ))}
          {entry.year > 0 && (
            <span className="pill text-[10px]">{entry.year}</span>
          )}
          {entry.format !== 'Other' && (
            <span className="pill text-[10px]">{entry.format}</span>
          )}
        </div>
      )}
      {looked && entry.tracklist.length > 0 && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {entry.tracklist.length} tracks · {entry.tracklist.slice(0, 3).join(', ')}
          {entry.tracklist.length > 3 ? '…' : ''}
        </p>
      )}

      {lookupError && (
        <p className="text-xs" style={{ color: '#dc2626' }}>
          {lookupError.includes('503') || lookupError.includes('configured')
            ? 'Lookup requires the backend to be deployed. Artist & album saved manually.'
            : `Lookup failed: ${lookupError}`}
        </p>
      )}

      {/* Lookup + Save buttons */}
      <div className="flex gap-2">
        <button
          className="btn-primary text-xs flex-1 justify-center"
          onClick={handleLookup}
          disabled={isLooking || !artist.trim() || !album.trim()}
        >
          {isLooking ? '🔍 Looking up…' : looked ? '↻ Re-lookup' : '🔍 Look up'}
        </button>
        <button
          className="btn-ghost text-xs flex-1 justify-center"
          onClick={onSave}
          disabled={isSaving || !artist.trim() || !album.trim()}
        >
          {isSaving ? 'Saving…' : '💾 Save'}
        </button>
      </div>
    </div>
  )
}
