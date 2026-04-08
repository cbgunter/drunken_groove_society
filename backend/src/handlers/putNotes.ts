import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../lib/dynamo'
import { ok, err } from '../lib/cors'

interface EntryNotePayload {
  albumNotes: string
  trackNotes: Record<string, string>
  rating: number
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === 'OPTIONS') return ok({})

  const sessionId = event.pathParameters?.id
  if (!sessionId) return err('Missing session id', 400)

  let body: { userId: string; userName: string; entryId: string; notes: EntryNotePayload }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  const { userId, userName, entryId, notes } = body
  if (!userId || !entryId || !notes) return err('Missing required fields', 400)

  const pk = `SESSION#${sessionId}`
  const sk = `NOTES#${userId}`
  const now = new Date().toISOString()
  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60

  // Read existing item to merge (non-destructive to other entries)
  const existing = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }))
  const prevEntries = (existing.Item?.entries as Record<string, EntryNotePayload>) ?? {}

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: pk,
        SK: sk,
        userId,
        userName: userName || 'Anonymous',
        entries: { ...prevEntries, [entryId]: notes },
        updatedAt: now,
        ttl,
      },
    }),
  )

  return ok({ ok: true })
}
