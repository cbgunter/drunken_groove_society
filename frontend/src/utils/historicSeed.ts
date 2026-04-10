import type { Session } from '../types'

interface PickData {
  selector: string
  artist: string
  title: string
}

// Use fixed IDs so overallRatings keys are stable across re-seeds
function makeSession(
  month: string,
  picks: PickData[],
  done = false,
  ratings?: number[],  // per-pick rating in same order as picks array
): Session {
  const [year, mon] = month.split('-')
  const date = `${year}-${mon}-01`
  const now = new Date().toISOString()
  const monthDate = new Date(Number(year), Number(mon) - 1, 1)
  const title =
    monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }) +
    ' — Listening Session'

  // Deterministic IDs so ratings map stays consistent
  const entries = picks.map((pick, i) => ({
    id: `${month}-e${i}`,
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

  const overallRatings: Record<string, number> | undefined = ratings
    ? Object.fromEntries(entries.map((e, i) => [e.id, ratings[i]]))
    : undefined

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

export const HISTORIC_SESSIONS: Session[] = [
  makeSession(
    '2025-12',
    [
      { selector: 'Corey', artist: 'The Promise Ring',  title: 'The Horse Latitudes' },
      { selector: 'Doug',  artist: 'Mt. Joy',           title: 'Hope We Have Fun' },
      { selector: 'Mike',  artist: 'Radiohead',         title: 'In Rainbows' },
    ],
    true,
    [3.7, 4.0, 4.8],
  ),
  makeSession(
    '2026-01',
    [
      { selector: 'Corey', artist: 'The Get Up Kids', title: "The EP's: Red Letter Day & Woodsen" },
      { selector: 'Doug',  artist: 'Slobberbone',     title: 'Everything You Thought Was Right Was Wrong Today' },
      { selector: 'Mike',  artist: 'Joy Division',    title: 'Unknown Pleasures' },
    ],
    true,
    [4.2, 3.3, 4.7],
  ),
  makeSession(
    '2026-02',
    [
      { selector: 'Doug',  artist: 'The Heavy',         title: 'The House That Dirt Built' },
      { selector: 'Mike',  artist: 'Amigos Invisibles', title: 'Arepa 3000' },
      { selector: 'Corey', artist: 'Bloc Party',        title: 'Silent Alarm' },
    ],
    true,
    [4.0, 3.5, 4.3],
  ),
  makeSession(
    '2026-03',
    [
      { selector: 'Corey', artist: 'Death From Above', title: 'House Of Strombo' },
      { selector: 'Doug',  artist: 'Harvey Danger',    title: 'King James Version' },
      { selector: 'Mike',  artist: 'Miles Davis',      title: 'Kind of Blue' },
    ],
    true,
    [4.5, 4.2, 5.0],
  ),
  // April — picks selected, no meeting this month
  makeSession(
    '2026-04',
    [
      { selector: 'Corey', artist: 'Interpol',          title: 'Turn On the Bright Lights' },
      { selector: 'Doug',  artist: 'Wilco',             title: 'Yankee Hotel Foxtrot' },
      { selector: 'Mike',  artist: 'D\'Angelo',         title: 'Voodoo' },
    ],
    false,  // not done — no meeting
  ),
  // May — albums selected, meeting not yet held
  makeSession(
    '2026-05',
    [
      { selector: 'Corey', artist: 'Various Artists', title: 'indiemono | brains in bloom (vol.7)' },
      { selector: 'Doug',  artist: 'Foals',           title: 'What Went Down' },
      { selector: 'Mike',  artist: 'Willie Colon',    title: 'La Cosa Nuestra' },
    ],
    false,  // not done — meeting hasn't happened yet
  ),
]

export const HISTORIC_ROSTER: [string, string, string] = ['Corey', 'Doug', 'Mike']

// Bump this when seed data changes to force a re-seed on existing clients
export const SEED_VERSION = 2
