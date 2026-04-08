import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import Anthropic from '@anthropic-ai/sdk'
import { ok, err } from '../lib/cors'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === 'OPTIONS') return ok({})

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'PLACEHOLDER') {
    return err('Lookup unavailable — API key not configured', 503)
  }

  let body: { artist: string; album: string }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  const { artist, album } = body
  if (!artist || !album) return err('Missing artist or album', 400)

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
              description: 'One paragraph about the band/artist at the time of this album. Include member names and their instruments.',
            },
            about_album: {
              type: 'string',
              description: 'One paragraph about the album — recording context, themes, why it matters.',
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
              description: 'Complete ordered track listing',
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
  if (!toolUse || toolUse.type !== 'tool_use') {
    return err('Lookup failed — no result', 500)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = toolUse.input as any

  // Build external_link from whichever URL is available
  let external_link: { label: string; url: string } | undefined
  if (data.spotify_url) {
    external_link = { label: 'Listen on Spotify', url: data.spotify_url }
  } else if (data.youtube_url) {
    external_link = { label: 'Watch on YouTube', url: data.youtube_url }
  }

  return ok({
    about_band:    data.about_band ?? '',
    about_album:   data.about_album ?? '',
    genre_tags:    (data.genre_tags ?? []).slice(0, 4),
    year:          data.year ?? 0,
    format:        data.format ?? 'LP',
    fun_facts:     data.fun_facts ?? [],
    tracklist:     data.tracklist ?? [],
    external_link,
  })
}
