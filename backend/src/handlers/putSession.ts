import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../lib/dynamo'
import { ok, err } from '../lib/cors'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === 'OPTIONS') return ok({})

  const id = event.pathParameters?.id
  if (!id) return err('Missing session id', 400)

  let session: Record<string, unknown>
  try {
    session = JSON.parse(event.body ?? '{}')
  } catch {
    return err('Invalid JSON', 400)
  }

  if (!session.title && !session.date) return err('Invalid session', 400)

  const now = Math.floor(Date.now() / 1000)
  const ttl = now + 90 * 24 * 60 * 60 // 90 days

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `SESSION#${id}`,
        SK: 'METADATA',
        ...session,
        id,
        entries: JSON.stringify(session.entries ?? []),
        updatedAt: new Date().toISOString(),
        ttl,
      },
    }),
  )

  return ok({ id })
}
