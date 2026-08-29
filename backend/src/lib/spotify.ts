// Spotify Web API — album metadata lookup via the client-credentials flow.
// No user context, no refresh token: request a bearer token, cache it for its
// hour of life (Lambda containers are reused), re-request on expiry.

import {
  EDITION_NOISE,
  type LookupFormat,
  anyArtistMatches,
  cleanTrackName,
  normalize,
  parseYear,
  titlesMatch,
} from './match'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ''

export interface SpotifyAlbumInfo {
  year: number
  format: LookupFormat
  tracklist: string[]
  spotifyUrl: string
}

export function spotifyConfigured(): boolean {
  return (
    !!CLIENT_ID && CLIENT_ID !== 'PLACEHOLDER' &&
    !!CLIENT_SECRET && CLIENT_SECRET !== 'PLACEHOLDER'
  )
}

// ── Auth ─────────────────────────────────────────────────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`)

  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000, // refresh a minute early
  }
  return cachedToken.value
}

// Accepts an API path ("/search?…") or an absolute URL (Spotify's pagination
// `next` links are absolute). Returns null on any non-OK response so the lookup
// falls through to MusicBrainz/Claude rather than throwing.
async function spotifyGet<T>(pathOrUrl: string): Promise<T | null> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API}${pathOrUrl}`

  let token = await getToken()
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  if (res.status === 401) {
    cachedToken = null
    token = await getToken()
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  }

  if (!res.ok) return null
  return (await res.json()) as T
}

// ── Matching ─────────────────────────────────────────────────────────────────

interface SpotifySimpleArtist {
  id: string
  name: string
}

interface SpotifyAlbumItem {
  id: string
  name: string
  album_type: 'album' | 'single' | 'compilation'
  release_date: string
  total_tracks: number
  artists: SpotifySimpleArtist[]
  external_urls: { spotify: string }
}

interface SpotifySearchResponse {
  albums?: { items?: SpotifyAlbumItem[] }
}

interface SpotifyTrackItem {
  name: string
}

interface SpotifyTrackPage {
  items: SpotifyTrackItem[]
  next: string | null
}

interface SpotifyAlbumFull extends SpotifyAlbumItem {
  tracks: SpotifyTrackPage
}

function artistNames(cand: SpotifyAlbumItem): string[] {
  return cand.artists.map((a) => a.name)
}

function acceptable(cand: SpotifyAlbumItem, artist: string, album: string): boolean {
  return titlesMatch(cand.name, album) && anyArtistMatches(artistNames(cand), artist)
}

function scoreCandidate(cand: SpotifyAlbumItem, artist: string, album: string): number {
  let score = 0

  if (normalize(cand.name) === normalize(album)) score += 5
  else if (titlesMatch(cand.name, album)) score += 2

  if (cand.artists.some((a) => normalize(a.name) === normalize(artist))) score += 3
  else if (anyArtistMatches(artistNames(cand), artist)) score += 1

  if (cand.album_type === 'album') score += 1
  if (EDITION_NOISE.test(cand.name) && !EDITION_NOISE.test(album)) score -= 3

  return score
}

async function searchAlbums(query: string): Promise<SpotifyAlbumItem[]> {
  // limit is capped at 10 for this app's credentials.
  const data = await spotifyGet<SpotifySearchResponse>(
    `/search?type=album&limit=10&q=${encodeURIComponent(query)}`,
  )
  return data?.albums?.items ?? []
}

async function findAlbum(artist: string, album: string): Promise<SpotifyAlbumItem | null> {
  // Field-filtered query is precise when it works (it often returns nothing on
  // this app's restricted credentials); the bare query is the real workhorse.
  // Rank the union so the best edition wins overall.
  const [filtered, loose] = await Promise.all([
    searchAlbums(`album:${album} artist:${artist}`),
    searchAlbums(`${artist} ${album}`),
  ])

  const byId = new Map<string, SpotifyAlbumItem>()
  for (const c of [...filtered, ...loose]) if (c?.id) byId.set(c.id, c)

  const ranked = [...byId.values()]
    .filter((c) => acceptable(c, artist, album))
    .map((c) => ({ c, s: scoreCandidate(c, artist, album) }))
    .sort(
      (x, y) =>
        y.s - x.s ||
        x.c.name.length - y.c.name.length || // shorter title ≈ cleaner edition
        x.c.release_date.localeCompare(y.c.release_date), // then earliest press
    )

  return ranked[0]?.c ?? null
}

function toFormat(album: SpotifyAlbumFull): LookupFormat {
  if (album.album_type === 'compilation') return 'Compilation'
  if (album.album_type === 'single') return album.total_tracks >= 3 ? 'EP' : 'Single'
  return 'LP'
}

// ── Public entry point ───────────────────────────────────────────────────────

export async function lookupAlbumOnSpotify(
  artist: string,
  album: string,
): Promise<SpotifyAlbumInfo | null> {
  if (!spotifyConfigured()) return null
  try {
    const match = await findAlbum(artist, album)
    if (!match) return null

    const full = await spotifyGet<SpotifyAlbumFull>(`/albums/${match.id}`)
    if (!full) return null

    const tracklist: string[] = []
    const push = (t: SpotifyTrackItem) => {
      const name = cleanTrackName(t.name)
      if (name) tracklist.push(name)
    }
    for (const t of full.tracks.items) push(t)
    let next = full.tracks.next
    while (next) {
      const page = await spotifyGet<SpotifyTrackPage>(next)
      if (!page) break
      for (const t of page.items) push(t)
      next = page.next
    }
    if (!tracklist.length) return null

    return {
      year: parseYear(full.release_date),
      format: toFormat(full),
      tracklist,
      spotifyUrl: full.external_urls?.spotify ?? match.external_urls?.spotify ?? '',
    }
  } catch (e) {
    console.error('Spotify lookup failed', e)
    return null
  }
}
