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
    const selectorLine = entry.selector ? `**Selected by:** ${entry.selector}` : ''

    const noteBlocks = allNotes
      .map((user) => {
        const raw = user.entries[entry.id]
        if (!raw) return null
        const notes = resolveEntryNotes(raw)
        const parts: string[] = []
        if (notes.rating) parts.push(`Rating: ${'🎵'.repeat(notes.rating)} ${notes.rating}/5`)
        if (notes.albumNotes?.trim()) parts.push(notes.albumNotes.trim())
        if (notes.trackNotes) {
          for (const [track, note] of Object.entries(notes.trackNotes)) {
            if (note?.trim()) parts.push(`  **${track}:** ${note.trim()}`)
          }
        }
        if (!parts.length) return null
        return `**${user.userName || user.userId}:**\n${parts.join('\n')}`
      })
      .filter(Boolean)
      .join('\n\n') || '_No notes submitted for this entry._'

    return [
      `### ${entry.badge_emoji} ${entry.artist} — ${entry.title} (${entry.year}) [${entry.format}]`,
      selectorLine,
      entry.genre_tags.length ? `Tags: ${entry.genre_tags.join(', ')}` : '',
      entry.about_band ? `**About the band:** ${entry.about_band}` : '',
      entry.about_album ? `**About the album:** ${entry.about_album}` : '',
      entry.fun_facts.length
        ? `**Fun facts:**\n${entry.fun_facts.map((f) => `- ${f}`).join('\n')}`
        : '',
      entry.tracklist.length ? `**Tracklist:** ${entry.tracklist.join(', ')}` : '',
      `**Listener notes:**\n${noteBlocks}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  })

  return [
    `# ${session.title} — ${session.date}`,
    '',
    ...entryBlocks,
    '',
    '---',
    '',
    `Generate a structured meeting guide in markdown for these ${session.entries.length} albums. Structure your response exactly as follows:`,
    '',
    '## Overall Summary',
    '2-3 paragraphs covering the session as a whole: common threads, contrasts, standout moments from the notes.',
    '',
    'Then for each album, a section with this exact structure:',
    '',
    "## [badge] [Artist] — [Title] ([selector]'s pick)",
    '',
    '### Talking points',
    '4-6 specific bullet points to discuss during the meeting, drawn from the album context and listener notes.',
    '',
    '### Note highlights',
    'For each person who submitted notes, pull out 1-2 of their most interesting or specific observations (quote them directly when possible). Skip people with no notes.',
    '',
    'After all album sections:',
    '',
    '## Discussion questions',
    '5-7 open-ended questions to spark conversation across the whole group during the meeting. Make them specific to these albums and notes — not generic.',
    '',
    'Be warm, specific, and enthusiastic. Reference the listener notes directly.',
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
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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
