import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../lib/dynamo'
import { ok, err } from '../lib/cors'
import { withAuth } from '../lib/auth'

// Any authenticated caller can still write the whole session object here —
// restricting a caller to only their own `selector`'s entry would break
// MeetingView.handleEndMeeting -> lockSession -> saveToRemote, which
// legitimately writes the whole session. Among three friends that isn't
// the threat model; noted as a possible follow-up, not done here.
export const handler = withAuth(async (event) => {
  const id = event.pathParameters?.id
  if (!id) return err('Missing session id', 400)

  let session: Record<string, unknown>
  try {
    session = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  if (!session.title || !session.date) return err('Invalid session', 400)

  const now = Math.floor(Date.now() / 1000)
  const ttl = now + 5 * 365 * 24 * 60 * 60 // 5 years

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `SESSION#${id}`,
        SK: 'METADATA',
        ...session,
        id,
        entries: session.entries ?? [],
        updatedAt: new Date().toISOString(),
        ttl,
      },
    }),
  )

  return ok({ id })
})
