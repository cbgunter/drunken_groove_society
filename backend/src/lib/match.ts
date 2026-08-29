// Fuzzy artist/album matching shared by the Spotify and MusicBrainz lookups.
// Both catalogs return noisy titles ("(Deluxe Edition)", "- Remastered 2009")
// and slightly different spellings than what a user types, so matches are token
// based rather than exact.

export type LookupFormat = 'LP' | 'EP' | 'Single' | 'Live' | 'Compilation' | 'Other'

// Reissue/edition words common in catalog titles, rare in user input. A
// candidate carrying one the query doesn't get penalised so the plain original
// wins over "(Deluxe)" / "(Disk 2)" / "(Remastered)".
export const EDITION_NOISE =
  /\b(deluxe|remaster|remastered|expanded|anniversary|edition|version|disk|disc|reissue|bonus|mono|stereo|instrumentals?|karaoke|commentary|a[\s-]?cappella)\b/i

export function normalize(s: string): string {
  const base = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ') // drop "(Deluxe Edition)" / "[Remastered]"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  // Cheap aliases so "Lift Yr Skinny Fists" ≈ "Lift Your …", "Guns N Roses" ≈
  // "Guns and Roses", and a dropped leading "The" doesn't break the match.
  return ` ${base} `
    .replace(/ yr /g, ' your ')
    .replace(/ n /g, ' and ')
    .replace(/^ the /, ' ')
    .trim()
}

export function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean)
}

// Fraction of `want`'s words that also appear in `have`.
export function overlap(want: string[], have: string[]): number {
  if (!want.length || !have.length) return 0
  const set = new Set(have)
  let hit = 0
  for (const w of want) if (set.has(w)) hit++
  return hit / want.length
}

// Album-title match — tolerant of a reissue suffix or one dropped word.
export function titlesMatch(candTitle: string, want: string): boolean {
  const c = tokens(candTitle)
  const w = tokens(want)
  if (!c.length || !w.length) return false
  if (normalize(candTitle) === normalize(want)) return true
  return overlap(w, c) >= 0.6 || overlap(c, w) >= 0.75
}

// Artist-name match — must be strong in both directions, so "The Beatles" does
// not match "The Beatles Complete On Ukulele".
export function artistNameMatch(candName: string, want: string): boolean {
  const c = tokens(candName)
  const w = tokens(want)
  if (!c.length || !w.length) return false
  if (normalize(candName) === normalize(want)) return true
  return overlap(w, c) >= 0.7 && overlap(c, w) >= 0.6
}

export function anyArtistMatches(names: string[], want: string): boolean {
  return names.some((n) => artistNameMatch(n, want))
}

export function parseYear(date: string | undefined): number {
  const y = parseInt((date ?? '').slice(0, 4), 10)
  return Number.isFinite(y) ? y : 0
}

// Trim a trailing "- Remastered 2011" / "- 2009 Remaster" / "- Mono Version"
// suffix that catalogs hang off every track title on a reissue.
export function cleanTrackName(name: string): string {
  return name
    .replace(/\s*-\s*(\d{4}\s+)?(remaster(ed)?|mono|stereo)(\s+version)?(\s+\d{4})?$/i, '')
    .trim()
}
