import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../lib/dynamo'
import { ok, err } from '../lib/cors'
import { withAuth } from '../lib/auth'

export const handler = withAuth(async (event) => {
  const id = event.pathParameters?.id
  if (!id) return err('Missing session id', 400)

  const result = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `SESSION#${id}`, SK: 'METADATA' } }),
  )

  if (!result.Item) return err('Session not found', 404)

  const { PK, SK, ttl, ...rest } = result.Item
  const session = {
    ...rest,
    entries: typeof rest.entries === 'string' ? JSON.parse(rest.entries) : rest.entries,
  }

  return ok(session)
})
