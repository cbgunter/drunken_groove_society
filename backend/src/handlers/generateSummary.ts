import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import Anthropic from '@anthropic-ai/sdk'
import { ok, err } from '../lib/cors'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''

interface Entry {
  id: string
  selector?: string
  artist: string
  title: string
  year: number
  format: string
  genre_tags: string[]
  badge_emoji: string
  about_band: string
  about_album: string
  fun_facts: string[]
  tracklist: string[]
  external_link?: { label: string; url: string }
}

interface Session {
  id: string
  title: string
  date: string
  entries: Entry[]
}

interface EntryNotes {
  albumNotes?: string
  trackNotes?: Record<string, string>
  rating?: number
}

interface UserSessionNotes {
  userId: string
  userName: string
  entries: Record<string, EntryNotes | { current?: EntryNotes }>
}

function resolveEntryNotes(raw: EntryNotes | { current?: EntryNotes }): EntryNotes {
  // Handle both flat format (from DynamoDB) and nested { current: ... } format
  if ('current' in raw && raw.current) return raw.current as EntryNotes
  return raw as EntryNotes
}

function buildPrompt(session: Session, allNotes: UserSessionNotes[]): string {
  const entryBlocks = session.entries.map((entry) => {
    const noteBlocks = allNotes
      .map((user) => {
        const raw = user.entries[entry.id]
        if (!raw) return null
        const notes = resolveEntryNotes(raw)
        const parts: string[] = []
        if (notes.rating) parts.push(`Rating: ${notes.rating}/5`)
        if (notes.albumNotes?.trim()) parts.push(notes.albumNotes.trim())
        if (notes.trackNotes) {
          for (const [track, note] of Object.entries(notes.trackNotes)) {
            if (note?.trim()) parts.push(`  [${track}]: ${note.trim()}`)
          }
        }
        if (!parts.length) return null
        return `${user.userName || user.userId}:\n${parts.join('\n')}`
      })
      .filter(Boolean)
      .join('\n\n') || '_No notes submitted._'

    return [
      `### ${entry.badge_emoji} ${entry.artist} — ${entry.title}${entry.selector ? ` (${entry.selector}'s pick)` : ''}${entry.year ? ` [${entry.year}]` : ''}`,
      entry.genre_tags.length ? `Genre: ${entry.genre_tags.join(', ')}` : '',
      `Notes:\n${noteBlocks}`,
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    'Listener notes for a small music club meeting:',
    '',
    ...entryBlocks,
    '',
    '---',
    '',
    'Write a concise meeting guide in markdown. Use only information from these notes.',
    '',
    '## Common threads',
    'One short paragraph: shared reactions, moods, or themes that cut across albums or listeners.',
    '',
    '## Points of contention',
    'One short paragraph: where listeners disagreed — different ratings, conflicting reactions to the same track or album.',
    '',
    `For each of the ${session.entries.length} albums, one section:`,
    "## [emoji] [Artist] — [Title] ([selector]'s pick)",
    '- 3–4 specific talking points drawn directly from the listener notes',
    '',
    '## Questions for the table',
    '3–4 pointed questions tailored to these albums and notes.',
    '',
    'Be direct and specific. Under 600 words. No filler.',
  ].join('\n')
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === 'OPTIONS') return ok({})

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'PLACEHOLDER') {
    return err('Summary unavailable — API key not configured', 503)
  }

  let body: { session: Session; allNotes: UserSessionNotes[] }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  const { session, allNotes } = body
  if (!session?.entries) return err('Invalid request body', 400)

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system:
      'You are a music journalist writing a structured meeting guide for a small listening club. Write in markdown. Be warm, specific, and opinionated. Reference listener notes directly when possible. Never pad with generic filler.',
    messages: [{ role: 'user', content: buildPrompt(session, allNotes ?? []) }],
  })

  const summary = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  return ok({ summary })
}
