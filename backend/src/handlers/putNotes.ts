import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../lib/dynamo'
import { ok, err } from '../lib/cors'
import { withAuth } from '../lib/auth'

interface EntryNotePayload {
  albumNotes: string
  trackNotes: Record<string, string>
  rating: number
  pickerNote?: string
  trackReactions?: Record<string, 'loved' | 'mixed' | 'meh'>
  savedAt?: string
}

export const handler = withAuth(async (event, caller) => {
  const sessionId = event.pathParameters?.id
  if (!sessionId) return err('Missing session id', 400)
  if ((event.body ?? '').length > 200_000) return err('Payload too large', 413)

  let body: { entryId: string; notes: EntryNotePayload }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  // Note: the frontend still sends userId/userName in the body during the
  // staged rollout (dropped in the cleanup pass) — ignored here on purpose.
  // The sort key comes only from the verified JWT.
  const { entryId, notes } = body
  if (!entryId || !notes) return err('Missing required fields', 400)

  const pk = `SESSION#${sessionId}`
  const sk = `NOTES#${caller.userId}`
  const now = new Date().toISOString()
  const ttl = Math.floor(Date.now() / 1000) + 5 * 365 * 24 * 60 * 60 // 5 years

  // Read existing item to merge (non-destructive to other entries)
  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }))
  const prevEntries = (existing.Item?.entries as Record<string, EntryNotePayload>) ?? {}

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: pk,
        SK: sk,
        userId: caller.userId,
        userName: caller.userName || 'Anonymous',
        entries: { ...prevEntries, [entryId]: { ...notes, savedAt: now } },
        updatedAt: now,
        ttl,
      },
    }),
  )

  return ok({ ok: true })
})
