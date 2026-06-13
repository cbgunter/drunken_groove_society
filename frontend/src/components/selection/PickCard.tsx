import { useState } from 'react'
import type { Entry, LookupResult } from '../../types'
import { api } from '../../api/client'

interface Props {
  entry: Entry
  onChange: (updates: Partial<Entry>) => void
  onSave: () => Promise<void> | void
  isSaving: boolean
}

async function fetchMusicBrainzTracklist(artist: string, album: string): Promise<string[]> {
  try {
    const query = `artist:"${artist}" AND release:"${album}"`
    const searchRes = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=3&fmt=json`,
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const releases: Array<{ id: string }> = searchData.releases ?? []
    if (!releases.length) return []

    const releaseRes = await fetch(
      `https://musicbrainz.org/ws/2/release/${releases[0].id}?inc=recordings&fmt=json`,
    )
    if (!releaseRes.ok) return []
    const releaseData = await releaseRes.json()

    const tracks: string[] = []
    for (const medium of releaseData.media ?? []) {
      for (const track of medium.tracks ?? []) {
        const name: string = track.title || track.recording?.title || ''
        if (name) tracks.push(name)
      }
    }
    return tracks
  } catch {
    return []
  }
}

function TracklistEditor({
  tracks,
  onChange,
}: {
  tracks: string[]
  onChange: (t: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])

  if (!tracks.length) return null

  if (editing) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Edit tracklist
        </p>
        <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
          {draft.map((track, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="text-[10px] w-5 text-right flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                {i + 1}.
              </span>
              <input
                value={track}
                onChange={(e) => {
                  const next = [...draft]
                  next[i] = e.target.value
                  setDraft(next)
                }}
                className="flex-1 rounded px-2 py-0.5 text-xs outline-none"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            className="btn-primary text-[10px] px-2 py-0.5"
            onClick={() => {
              onChange(draft.filter((t) => t.trim()))
              setEditing(false)
            }}
          >
            ✓ Confirm
          </button>
          <button
            className="btn-ghost text-[10px] px-2 py-0.5"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {tracks.length} tracks · {tracks.slice(0, 3).join(', ')}
        {tracks.length > 3 ? '…' : ''}
      </p>
      <button
        className="text-[10px] flex-shrink-0 underline"
        style={{ color: 'var(--accent)' }}
        onClick={() => {
          setDraft([...tracks])
          setEditing(true)
        }}
      >
        ✎ Edit
      </button>
    </div>
  )
}

export default function PickCard({ entry, onChange, onSave, isSaving }: Props) {
  const [artist, setArtist] = useState(entry.artist || '')
  const [album, setAlbum] = useState(entry.title || '')
  const [isLooking, setIsLooking] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [looked, setLooked] = useState(entry.tracklist.length > 0 || entry.genre_tags.length > 0)

  // Lookup result held in local state until the user confirms — calling onChange()
  // immediately would update the Zustand session, trigger derivePhase → 'listening',
  // and switch the view to ListeningView before the user can confirm the pick.
  const [pending, setPending] = useState<Partial<Entry> | null>(
    entry.tracklist.length > 0 || entry.genre_tags.length > 0 ? entry : null,
  )

  const displayTracks = pending?.tracklist ?? entry.tracklist
  const displayGenreTags = pending?.genre_tags ?? entry.genre_tags
  const displayYear = pending?.year ?? entry.year
  const displayFormat = pending?.format ?? entry.format

  const inputStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  async function handleLookup() {
    if (!artist.trim() || !album.trim()) return
    setIsLooking(true)
    setLookupError('')
    try {
      const [result, mbTracks]: [LookupResult, string[]] = await Promise.all([
        api.lookupAlbum({ artist: artist.trim(), album: album.trim() }),
        fetchMusicBrainzTracklist(artist.trim(), album.trim()),
      ])
      // Hold in local state — do NOT call onChange yet (would trigger phase change)
      setPending({
        artist: artist.trim(),
        title: album.trim(),
        about_band: result.about_band,
        about_album: result.about_album,
        genre_tags: result.genre_tags,
        year: result.year,
        format: result.format,
        fun_facts: result.fun_facts,
        tracklist: mbTracks.length > 0 ? mbTracks : result.tracklist,
        external_link: result.external_link,
        badge_emoji: entry.badge_emoji,
      })
      setLooked(true)
    } catch (e) {
      setLookupError((e as Error).message)
    } finally {
      setIsLooking(false)
    }
  }

  async function handleConfirm() {
    // Commit the pending result to the parent Zustand store.
    // Zustand's set() is synchronous, so saveToRemote's get() sees the update immediately.
    const updates = pending ?? { artist: artist.trim(), title: album.trim() }
    onChange(updates)
    await onSave()
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
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {entry.selector[0]?.toUpperCase()}
        </span>
        <span className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
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
      {looked && (
        <>
          {displayGenreTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {displayGenreTags.map((t) => (
                <span key={t} className="pill text-[10px]">{t}</span>
              ))}
              {displayYear > 0 && (
                <span className="pill text-[10px]">{displayYear}</span>
              )}
              {displayFormat !== 'Other' && (
                <span className="pill text-[10px]">{displayFormat}</span>
              )}
            </div>
          )}
          <TracklistEditor
            tracks={displayTracks}
            onChange={(tracks) => setPending((prev) => ({ ...(prev ?? {}), tracklist: tracks }))}
          />
        </>
      )}

      {lookupError && (
        <p className="text-xs" style={{ color: '#dc2626' }}>
          {lookupError.includes('503') || lookupError.includes('configured')
            ? 'Lookup requires the backend to be deployed. You can still save manually.'
            : `Lookup failed: ${lookupError}`}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          className="btn-ghost text-xs flex-1 justify-center"
          onClick={handleLookup}
          disabled={isLooking || !artist.trim() || !album.trim()}
        >
          {isLooking ? 'Looking up…' : looked ? 'Re-lookup' : 'Look up'}
        </button>
        <button
          className="btn-primary text-xs flex-1 justify-center"
          onClick={handleConfirm}
          disabled={isSaving || (!artist.trim() && !album.trim())}
        >
          {isSaving ? 'Saving…' : looked ? 'Confirm pick' : 'Save'}
        </button>
      </div>
    </div>
  )
}
