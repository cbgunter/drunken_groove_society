import { nanoid } from 'nanoid'
import type { Session } from '../types'

interface PickData {
  selector: string
  artist: string
  title: string
}

function makeSession(
  month: string,
  picks: PickData[],
  done = false,
  overallRatings?: Record<string, number>,
): Session {
  const [year, mon] = month.split('-')
  const date = `${year}-${mon}-01`
  const now = new Date().toISOString()
  const monthDate = new Date(Number(year), Number(mon) - 1, 1)
  const title =
    monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }) +
    ' — Listening Session'

  const entries = picks.map((pick) => ({
    id: nanoid(10),
    selector: pick.selector,
    artist: pick.artist,
    title: pick.title,
    year: Number(year),
    format: 'LP' as const,
    genre_tags: [],
    badge_emoji: '🎵',
    about_band: '',
    about_album: '',
    fun_facts: [],
    tracklist: [],
    external_link: undefined,
  }))

  return {
    id: month,
    month,
    title,
    date,
    entries,
    phase: done ? 'done' : 'listening',
    locked: done,
    overallRatings,
    createdAt: now,
    updatedAt: now,
  }
}

// Note: user wrote "2025-January/February" — corrected to 2026-01 / 2026-02
export const HISTORIC_SESSIONS: Session[] = [
  makeSession(
    '2025-12',
    [
      { selector: 'Corey', artist: 'The Promise Ring', title: 'The Horse Latitudes' },
      { selector: 'Doug',  artist: 'Mt. Joy',          title: 'Hope We Have Fun' },
      { selector: 'Mike',  artist: 'Radiohead',         title: 'In Rainbows' },
    ],
    true,
    { 'entry-0': 3.7, 'entry-1': 4.0, 'entry-2': 4.8 },
  ),
  makeSession(
    '2026-01',
    [
      { selector: 'Corey', artist: 'The Get Up Kids', title: "The EP's: Red Letter Day & Woodsen" },
      { selector: 'Doug',  artist: 'Slobberbone',     title: 'Everything You Thought Was Right Was Wrong Today' },
      { selector: 'Mike',  artist: 'Joy Division',    title: 'Unknown Pleasures' },
    ],
    true,
    { 'entry-0': 4.2, 'entry-1': 3.3, 'entry-2': 4.7 },
  ),
  makeSession(
    '2026-02',
    [
      { selector: 'Doug',  artist: 'The Heavy',         title: 'The House That Dirt Built' },
      { selector: 'Mike',  artist: 'Amigos Invisibles', title: 'Arepa 3000' },
      { selector: 'Corey', artist: 'Bloc Party',        title: 'Silent Alarm' },
    ],
    true,
    { 'entry-0': 4.0, 'entry-1': 3.5, 'entry-2': 4.3 },
  ),
  makeSession(
    '2026-03',
    [
      { selector: 'Corey', artist: 'Death From Above', title: 'House Of Strombo' },
      { selector: 'Doug',  artist: 'Harvey Danger',    title: 'King James Version' },
      { selector: 'Mike',  artist: 'Miles Davis',      title: 'Kind of Blue' },
    ],
    true,
    { 'entry-0': 4.5, 'entry-1': 4.2, 'entry-2': 5.0 },
  ),
  makeSession(
    '2026-05',
    [
      { selector: 'Corey', artist: 'Various Artists', title: 'indiemono | brains in bloom (vol.7)' },
      { selector: 'Doug',  artist: 'Foals',           title: 'What Went Down' },
      { selector: 'Mike',  artist: 'Willie Colon',    title: 'La Cosa Nuestra' },
    ],
    true,
    { 'entry-0': 3.8, 'entry-1': 3.7, 'entry-2': 4.1 },
  ),
]

export const HISTORIC_ROSTER: [string, string, string] = ['Corey', 'Doug', 'Mike']
