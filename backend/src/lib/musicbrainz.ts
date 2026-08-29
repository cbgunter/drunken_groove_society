// MusicBrainz — the coverage layer for records Spotify's (restricted) search
// can't find. No API key; MusicBrainz asks for a descriptive User-Agent and
// rate-limits anonymous callers to ~1 req/s, and its public server returns 503
// under load, so every call retries with backoff. Two calls per lookup:
// release-group search, then a release browse with recordings embedded.

import {
  EDITION_NOISE,
  type LookupFormat,
  anyArtistMatches,
  cleanTrackName,
  normalize,
  parseYear,
  titlesMatch,
} from './match'

const WS = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'DrunkenGrooveSociety/1.0 ( https://dgs.caseyhunter.net )'
// The public server 503s freely under load; back off and try again a few times.
const RETRY_BACKOFF_MS = [500, 1200, 2500, 4000]
// Anonymous callers get ~1 req/s — space our two calls so we don't 503 ourselves.
const RATE_GAP_MS = 1100
const PER_REQUEST_TIMEOUT_MS = 8000
// Overall wall-clock budget: LookupFunction has 30s and Claude runs in parallel,
// so cap MusicBrainz well short of that no matter how the retries go.
const TOTAL_BUDGET_MS = 18_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface MusicBrainzAlbumInfo {
  year: number
  format: LookupFormat
  tracklist: string[]
}

interface ArtistCredit {
  name: string
  artist?: { name: string }
}

interface ReleaseGroup {
  id: string
  title: string
  'primary-type': string | null
  'secondary-types'?: string[]
  'first-release-date'?: string
  score?: number
  'artist-credit'?: ArtistCredit[]
}

interface MbTrack {
  title: string
}

interface MbMedium {
  format?: string
  tracks?: MbTrack[]
}

interface MbRelease {
  id: string
  date?: string
  status?: string
  media?: MbMedium[]
}

async function mbGet<T>(path: string, deadline: number): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return null
    try {
      const res = await fetch(`${WS}/${path}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(Math.min(PER_REQUEST_TIMEOUT_MS, remaining)),
      })
      if (res.ok) return (await res.json()) as T
      // 404/400 etc. are terminal; only server-side hiccups are worth a retry.
      if (![429, 500, 502, 503, 504].includes(res.status)) return null
    } catch {
      // network error / timeout — falls through to the retry check
    }
    if (attempt >= RETRY_BACKOFF_MS.length) return null
    if (deadline - Date.now() <= RETRY_BACKOFF_MS[attempt]) return null
    await sleep(RETRY_BACKOFF_MS[attempt])
  }
}

// Strip the double-quote and backslash that would break out of a Lucene phrase;
// everything else is literal inside the quotes we wrap values in.
function lucene(s: string): string {
  return s.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

function creditNames(rg: ReleaseGroup): string[] {
  const out: string[] = []
  for (const ac of rg['artist-credit'] ?? []) {
    if (ac.name) out.push(ac.name)
    if (ac.artist?.name) out.push(ac.artist.name)
  }
  return out
}

const OFF_ALBUM_SECONDARY = new Set([
  'Compilation',
  'Live',
  'Soundtrack',
  'Remix',
  'DJ-mix',
  'Mixtape/Street',
  'Demo',
  'Interview',
  'Audiobook',
  'Spokenword',
])

function scoreGroup(rg: ReleaseGroup, artist: string, album: string): number {
  const names = creditNames(rg)
  let score = (rg.score ?? 0) / 100 // MusicBrainz's own relevance, as a tiebreak

  if (normalize(rg.title) === normalize(album)) score += 5
  else if (titlesMatch(rg.title, album)) score += 2

  if (names.some((n) => normalize(n) === normalize(artist))) score += 3
  else if (anyArtistMatches(names, artist)) score += 1

  if (rg['primary-type'] === 'Album') score += 1
  if ((rg['secondary-types'] ?? []).some((t) => OFF_ALBUM_SECONDARY.has(t))) score -= 3
  if (EDITION_NOISE.test(rg.title) && !EDITION_NOISE.test(album)) score -= 2

  return score
}

function groupAcceptable(rg: ReleaseGroup, artist: string, album: string): boolean {
  if (!titlesMatch(rg.title, album)) return false
  const names = creditNames(rg)
  if (anyArtistMatches(names, artist)) return true
  // MusicBrainz occasionally omits artist-credit on a search hit; trust a
  // near-perfect score with an exact title instead.
  return (rg.score ?? 0) >= 95 && normalize(rg.title) === normalize(album)
}

function trackTitles(release: MbRelease): string[] {
  const out: string[] = []
  for (const medium of release.media ?? []) {
    for (const t of medium.tracks ?? []) {
      const name = cleanTrackName(t.title)
      if (name) out.push(name)
    }
  }
  return out
}

function toFormat(rg: ReleaseGroup): LookupFormat {
  const secondary = rg['secondary-types'] ?? []
  if (secondary.includes('Compilation')) return 'Compilation'
  if (secondary.includes('Live')) return 'Live'
  switch (rg['primary-type']) {
    case 'EP':
      return 'EP'
    case 'Single':
      return 'Single'
    case 'Album':
      return 'LP'
    default:
      return 'Other'
  }
}

export async function lookupAlbumOnMusicBrainz(
  artist: string,
  album: string,
): Promise<MusicBrainzAlbumInfo | null> {
  const deadline = Date.now() + TOTAL_BUDGET_MS
  try {
    const query = `releasegroup:"${lucene(album)}" AND artist:"${lucene(artist)}"`
    const search = await mbGet<{ 'release-groups'?: ReleaseGroup[] }>(
      `release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=8`,
      deadline,
    )
    const groups = search?.['release-groups'] ?? []

    const rg = groups
      .filter((g) => groupAcceptable(g, artist, album))
      .map((g) => ({ g, s: scoreGroup(g, artist, album) }))
      .sort(
        (x, y) =>
          y.s - x.s ||
          x.g.title.length - y.g.title.length ||
          (x.g['first-release-date'] ?? '9999').localeCompare(y.g['first-release-date'] ?? '9999'),
      )[0]?.g

    if (!rg) return null

    await sleep(RATE_GAP_MS)
    const browse = await mbGet<{ releases?: MbRelease[] }>(
      `release?release-group=${rg.id}&status=official&inc=recordings&fmt=json&limit=25`,
      deadline,
    )
    const releases = (browse?.releases ?? [])
      .map((r) => ({ r, tracks: trackTitles(r) }))
      .filter((x) => x.tracks.length > 0)

    // Fewest tracks = the standard edition, not a deluxe/bonus press; then the
    // earliest such release.
    const chosen = releases.sort(
      (x, y) =>
        x.tracks.length - y.tracks.length ||
        (x.r.date ?? '9999').localeCompare(y.r.date ?? '9999'),
    )[0]

    if (!chosen) return null

    return {
      year: parseYear(rg['first-release-date']),
      format: toFormat(rg),
      tracklist: chosen.tracks,
    }
  } catch (e) {
    console.error('MusicBrainz lookup failed', e)
    return null
  }
}
