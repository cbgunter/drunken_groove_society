import TrackPill from './TrackPill'

interface Props {
  tracks: string[]
  onTrackClick: (track: string) => void
}

export default function Tracklist({ tracks, onTrackClick }: Props) {
  if (!tracks.length) return null

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
        Tracklist — tap to stamp into notes
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tracks.map((track, i) => (
          <TrackPill key={i} track={track} index={i} onClick={onTrackClick} />
        ))}
      </div>
    </div>
  )
}
