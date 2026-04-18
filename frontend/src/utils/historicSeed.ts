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
        genre_tags: ['Indie Rock', 'Art Rock', 'Post-Punk Revival', 'Alternative'],
        about_band: 'Foals are an English rock band formed in Oxford in 2005. By 2015 the lineup was Yannis Philippakis (vocals/guitar), Jimmy Smith (guitar), Jack Bevan (drums), Edwin Congreave (keyboards), and Walter Gervers (bass). Known for their math rock origins, they had evolved into one of the UK\'s biggest festival headliners.',
        about_album: 'What Went Down is Foals\' fourth studio album, released on Warner Bros. It marked a heavier, more aggressive direction for the band. Produced by James Ford at Studios La Fabrique in southern France, the album balances crushing riffs with atmospheric slow-burners, reflecting themes of existential dread and catharsis.',
        fun_facts: [
          'The title track\'s riff was so heavy that the band initially worried it wouldn\'t sound like Foals.',
          'Recorded at La Fabrique in Saint-Rémy-de-Provence, the same studio used by Radiohead and Nick Cave.',
          'Yannis Philippakis crowd-surfed in an inflatable boat during the album\'s tour.',
          '"Mountain at My Gates" became their biggest radio hit and a festival staple.',
          'The album debuted at #3 on the UK Albums Chart, their highest-charting record at the time.',
          'Edwin Congreave left the band in 2022 to pursue climate activism.',
        ],
        tracklist: [
          'What Went Down', 'Mountain at My Gates', 'Birch Tree', 'Give It All',
          'Albatross', 'Snake Oil', 'Night Swimmers', 'A Knife in the Ocean',
          'London Thunder', 'Rain',
        ],
        external_link: { label: 'Listen on Spotify', url: 'https://open.spotify.com/album/5wFDP5IT40YKPG3aOChFvj' },
      },
      {
        selector: 'Mike',
        artist: 'Willie Colon',
        title: 'La Cosa Nuestra',
        year: 1970,
        genre_tags: ['Salsa', 'Latin Jazz', 'Boogaloo', 'Afro-Cuban'],
        about_band: 'Willie Colón was just 20 years old when he recorded La Cosa Nuestra, already a veteran of two prior albums. Born in the South Bronx to Puerto Rican parents, Colón played trombone and led a band that defined the gritty "Nuyorican" salsa sound. Héctor Lavoe, his longtime vocalist, brought an unmistakable voice full of street-wise swagger and emotional depth.',
        about_album: 'La Cosa Nuestra ("Our Thing") is Willie Colón\'s third album on Fania Records and a cornerstone of the salsa canon. It fused jazz harmonies with Afro-Cuban rhythms and a rebellious Bronx attitude. The album\'s title references the Cosa Nostra while reclaiming the phrase for Latin street culture. It pushed salsa toward a harder, brasher sound that would dominate the 1970s.',
        fun_facts: [
          'Colón was only 17 when Fania signed him — one of the youngest bandleaders in the label\'s history.',
          'The album cover features Colón and Lavoe in a gangster-movie pose, reinforcing the "Cosa Nostra" wordplay.',
          '"Che Che Colé" is based on a Ghanaian children\'s song, showing the deep African roots in salsa music.',
          'Héctor Lavoe\'s vocal on "Che Che Colé" became one of the most sampled salsa recordings ever.',
          'Fania Records was essentially the Motown of salsa — and this album helped cement its dominance.',
          'The trombone-forward arrangements were unusual for the time and became Colón\'s signature.',
        ],
        tracklist: [
          'Che Che Colé', 'No Me Llores', 'Cosa Nuestra', 'Te Conozco',
          'Yo Soy', 'La Banda', 'Quimbara (Intro)', 'Pa\' Colombia',
        ],
        external_link: { label: 'Listen on Spotify', url: 'https://open.spotify.com/album/1pMNKl1MphAMaqkOJjYJTg' },
      },
    ],
    false,
  ),
]

export const HISTORIC_ROSTER: [string, string, string] = ['Corey', 'Doug', 'Mike']

// Bump this when seed data changes to force a re-seed on existing clients
export const SEED_VERSION = 3
