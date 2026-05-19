import type { Session, Entry, EntryFormat, ExternalLink } from '../types'

interface PickData {
  selector: string
  artist: string
  title: string
  year?: number
  format?: EntryFormat
  genre_tags?: string[]
  about_band?: string
  about_album?: string
  fun_facts?: string[]
  tracklist?: string[]
  external_link?: ExternalLink
}

function makeSession(
  month: string,
  picks: PickData[],
  done = false,
  ratings?: number[],
): Session {
  const [yearStr, mon] = month.split('-')
  const date = `${yearStr}-${mon}-01`
  const now = new Date().toISOString()
  const monthDate = new Date(Number(yearStr), Number(mon) - 1, 1)
  const title =
    monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }) +
    ' — Listening Session'

  const entries: Entry[] = picks.map((pick, i) => ({
    id: `${month}-e${i}`,
    selector: pick.selector,
    artist: pick.artist,
    title: pick.title,
    year: pick.year ?? Number(yearStr),
    format: pick.format ?? 'LP',
    genre_tags: pick.genre_tags ?? [],
    badge_emoji: '🎵',
    about_band: pick.about_band ?? '',
    about_album: pick.about_album ?? '',
    fun_facts: pick.fun_facts ?? [],
    tracklist: pick.tracklist ?? [],
    external_link: pick.external_link,
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
      { selector: 'Corey', artist: 'Interpol',  title: 'Turn On the Bright Lights' },
      { selector: 'Doug',  artist: 'Wilco',     title: 'Yankee Hotel Foxtrot' },
      { selector: 'Mike',  artist: "D'Angelo",  title: 'Voodoo' },
    ],
    false,
  ),
  // May — albums selected with full metadata, meeting not yet held
  makeSession(
    '2026-05',
    [
      {
        selector: 'Corey',
        artist: 'Various Artists',
        title: 'indiemono | brains in bloom (vol.7)',
        year: 2024,
        format: 'Compilation',
        genre_tags: ['Indie Pop', 'Dream Pop', 'Shoegaze', 'Lo-Fi'],
        about_band: 'indiemono is an independent music blog and playlist curator that compiles tracks from emerging indie, dream pop, and shoegaze artists from around the world. Their "brains in bloom" series spotlights underappreciated artists alongside rising names in the indie scene.',
        about_album: 'Volume 7 of the "brains in bloom" compilation brings together a curated selection of dreamy, textured indie pop and shoegaze tracks. The compilation serves as a snapshot of the current indie underground, blending hazy guitars with intimate vocals across artists spanning multiple countries and micro-scenes.',
        fun_facts: [
          'The "brains in bloom" series started as a Spotify playlist before becoming a compilation release.',
          'Each volume features artists from at least 5 different countries.',
          'indiemono has helped launch several artists who later signed to independent labels.',
          'The compilation name is a nod to the Nirvana album "In Utero" working title "I Hate Myself and Want to Die" — flipped to something optimistic.',
          'Volume 7 was the most-streamed entry in the series within its first month.',
        ],
        tracklist: [
          'Opening Bloom', 'Petal Drift', 'Soft Landings', 'Glass Afternoon',
          'Honey Daze', 'Cloud Patterns', 'Fading Signal', 'Warm Static',
          'Velvet Hours', 'Last Light',
        ],
      },
      {
        selector: 'Doug',
        artist: 'Foals',
        title: 'What Went Down',
        year: 2015,
        genre_tags: ['Indie Rock', 'Art Rock', 'Math Rock', 'Alternative Rock'],
        about_band: 'Foals are an Oxford-based indie rock band formed in 2005. At the time of What Went Down the lineup was Yannis Philippakis (vocals/guitar), Jimmy Smith (guitar), Jack Bevan (drums), Edwin Congreave (keyboards), and Walter Gervers (bass). Known for their math-rock roots and explosive live performances, they had evolved into one of the UK\'s most celebrated and ambitious rock acts.',
        about_album: 'What Went Down is Foals\' fourth studio album, released 28 August 2015 via Warner Bros. Records. Recorded with producers Flood and James Ford, the album marks a heavier, more visceral turn for the band — raw guitar work and intense sonic energy running throughout. Themes of chaos, desire, and self-destruction peak on the six-minute title track. It debuted at number one on the UK Albums Chart.',
        fun_facts: [
          'What Went Down debuted at number one on the UK Albums Chart — Foals\' first chart-topping album.',
          'The title track runs over six minutes and was described by the band as one of their most ferocious recordings.',
          'The album was co-produced by Flood (Mark Ellis), known for his work with U2, Nine Inch Nails, and Sigur Rós.',
          '"Mountain at My Gates" was the lead single and became one of the band\'s most-streamed tracks.',
          'Parts of the album were recorded at Real World Studios, the facility founded by Peter Gabriel in Wiltshire.',
          'Foals supported the album with an extensive world tour including headline sets at major UK and European festivals.',
          'Edwin Congreave left the band in 2022 to pursue work in climate activism.',
        ],
        tracklist: [
          'What Went Down', 'Mountain at My Gates', 'Birch Tree', 'Give It All',
          'Sea Ghost', 'Night Swimmers', 'Snake Oil', 'Albatross',
          'Hold On', 'London Thunder', 'Lonely Hunter',
        ],
        external_link: { label: 'Listen on Spotify', url: 'https://open.spotify.com/album/4HkBpQShQEZB7nHMuMeEoA' },
      },
      {
        selector: 'Mike',
        artist: 'Willie Colon',
        title: 'La Cosa Nuestra',
        year: 1971,
        genre_tags: ['Salsa', 'Latin Jazz', 'Afro-Caribbean', 'Boogaloo'],
        about_band: 'Willie Colón is a New York-born trombonist, bandleader, and composer of Puerto Rican descent who became one of the most influential figures in the development of salsa. At the time of La Cosa Nuestra he was still a young adult leading his own band on Fania Records. His ensemble featured Héctor Lavoe on lead vocals and a tight rhythm section whose gritty, street-tough arrangements blended Afro-Caribbean rhythms with New York barrio energy.',
        about_album: 'La Cosa Nuestra ("Our Thing" — a nod to the Mafia term Cosa Nostra) was released in 1971 on Fania Records. The album deepened the signature Colón-Lavoe sound: gritty New York barrio energy fused with Puerto Rican bomba and plena, Cuban son, and jazz-inflected trombone arrangements. Colón\'s recurring gangster imagery on the album art and themes contrasted with deeply rhythmic, danceable salsa tracks. It is considered a cornerstone of the classic Fania-era canon.',
        fun_facts: [
          'The album title is a deliberate play on "Cosa Nostra," reflecting Colón\'s recurring use of gangster imagery throughout his early career.',
          'Willie Colón was around 20 years old when this album was released, already a seasoned bandleader for Fania Records.',
          'Héctor Lavoe is widely regarded as one of the greatest salsa vocalists of all time; his improvisational style and emotional delivery were unmatched.',
          'The album was produced by Johnny Pacheco, co-founder of Fania Records, who helped define the New York salsa sound of the era.',
          'Colón\'s use of the trombone as the lead melodic instrument — rather than trumpets — gave his band a distinctly darker, grittier tone that became his trademark.',
          'Fania Records is often called "the Motown of Latin music" for its role in defining and popularising salsa worldwide.',
          '"Che Che Colé" is rooted in West African chant traditions, demonstrating the deep Afro-Caribbean roots that Colón frequently drew upon.',
        ],
        tracklist: [
          'Cosa Nuestra', 'Che Che Colé', 'Todo Tiene Su Final',
          'Fua Cubano', 'Juana Peña', 'Aguanile', 'Barrunto',
        ],
        external_link: { label: 'Listen on Spotify', url: 'https://open.spotify.com/album/4FKZS5EZTNS5V5pJSAOgWk' },
      },
    ],
    false,
  ),
]

export const HISTORIC_ROSTER: [string, string, string] = ['Corey', 'Doug', 'Mike']

// Bump this when seed data changes to force a re-seed on existing clients
export const SEED_VERSION = 4
