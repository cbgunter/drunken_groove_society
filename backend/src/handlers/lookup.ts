import Anthropic from '@anthropic-ai/sdk'
import { ok, err } from '../lib/cors'
import { withAuth } from '../lib/auth'
import { lookupAlbumOnSpotify } from '../lib/spotify'
import { lookupAlbumOnMusicBrainz } from '../lib/musicbrainz'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const claudeConfigured = !!ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'PLACEHOLDER'

interface ClaudeLookup {
  about_band: string
  about_album: string
  genre_tags: string[]
  year: number
  format: string
  fun_facts: string[]
  tracklist: string[]
  spotify_url?: string
  youtube_url?: string
}

// Claude fills the editorial gaps Spotify can't: prose about the band and
// album, genre tags, fun facts — plus a tracklist/year/format used only as a
// fallback when the Spotify match fails.
async function claudeLookup(artist: string, album: string): Promise<ClaudeLookup | null> {
  if (!claudeConfigured) return null
  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [
        {
          name: 'music_lookup',
          description: 'Return structured music metadata for an artist and album',
          input_schema: {
            type: 'object' as const,
            properties: {
              about_band: {
                type: 'string',
                description:
                  'One paragraph about the band/artist at the time of this album. Include member names and their instruments.',
              },
              about_album: {
                type: 'string',
                description:
                  'One paragraph about the album — recording context, themes, why it matters.',
              },
              genre_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Up to 4 genre tags (e.g. "Indie Rock", "Post-Punk")',
              },
              year: {
                type: 'number',
                description: 'Release year',
              },
              format: {
                type: 'string',
                enum: ['LP', 'EP', 'Single', 'Live', 'Compilation', 'Other'],
                description: 'Album format',
              },
              fun_facts: {
                type: 'array',
                items: { type: 'string' },
                description: '5–7 interesting facts about the album or artist',
              },
              tracklist: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Complete ordered track listing. Return plain track names only — no track numbers, no numbering prefixes.',
              },
              spotify_url: {
                type: 'string',
                description: 'Spotify album URL if known, otherwise empty string',
              },
              youtube_url: {
                type: 'string',
                description: 'YouTube video/playlist URL if no Spotify link, otherwise empty string',
              },
            },
            required: ['about_band', 'about_album', 'genre_tags', 'year', 'format', 'fun_facts', 'tracklist'],
          },
        },
      ],
      tool_choice: { type: 'tool' as const, name: 'music_lookup' },
      messages: [
        {
          role: 'user',
          content: `Look up music metadata for: Artist: "${artist}", Album: "${album}"`,
        },
      ],
    })

    const toolUse = message.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toolUse.input as any as ClaudeLookup
  } catch (e) {
    console.error('Claude lookup failed', e)
    return null
  }
}

export const handler = withAuth(async (event) => {
  let body: { artist: string; album: string }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  const { artist, album } = body
  if (!artist || !album) return err('Missing artist or album', 400)
  if (artist.length > 200 || album.length > 200) return err('Artist and album must be 200 characters or fewer', 400)

  // Structured fields (tracklist/year/format) come from the first source that
  // has them, in order of trust: Spotify's exact catalog → MusicBrainz's wider
  // coverage → Claude. Claude also supplies the prose Spotify/MusicBrainz can't
  // (about_band, about_album, genre_tags, fun_facts). All three run in parallel.
  const [spotify, mb, claude] = await Promise.all([
    lookupAlbumOnSpotify(artist, album),
    lookupAlbumOnMusicBrainz(artist, album),
    claudeLookup(artist, album),
  ])

  if (!spotify && !mb && !claude) {
    return err('Lookup failed — no result', 502)
  }

  const rawTracks = spotify?.tracklist.length
    ? spotify.tracklist
    : mb?.tracklist.length
      ? mb.tracklist
      : claude?.tracklist ?? []
  const tracklist = rawTracks.map((t) => t.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)

  const year = spotify?.year || mb?.year || claude?.year || 0
  const format = spotify?.format ?? mb?.format ?? claude?.format ?? 'LP'

  let external_link: { label: string; url: string } | undefined
  if (spotify?.spotifyUrl) {
    external_link = { label: 'Listen on Spotify', url: spotify.spotifyUrl }
  } else if (claude?.spotify_url) {
    external_link = { label: 'Listen on Spotify', url: claude.spotify_url }
  } else if (claude?.youtube_url) {
    external_link = { label: 'Watch on YouTube', url: claude.youtube_url }
  }

  return ok({
    about_band:  claude?.about_band ?? '',
    about_album: claude?.about_album ?? '',
    genre_tags:  (claude?.genre_tags ?? []).slice(0, 4),
    year,
    format,
    fun_facts:   claude?.fun_facts ?? [],
    tracklist,
    external_link,
  })
})
