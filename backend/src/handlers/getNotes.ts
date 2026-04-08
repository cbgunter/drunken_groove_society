import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TABLE } from '../lib/dynamo'
import { ok, err } from '../lib/cors'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method === 'OPTIONS') return ok({})

  const sessionId = event.pathParameters?.id
  if (!sessionId) return err('Missing session id', 400)

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `SESSION#${sessionId}`,
        ':prefix': 'NOTES#',
      },
    }),
  )

  // Return as UserSessionNotes[] — one item per user, entries keyed by entryId
  const users = (result.Items ?? []).map((item) => ({
    userId: item.userId as string,
    userName: (item.userName as string) || 'Anonymous',
    entries: (item.entries as Record<string, unknown>) ?? {},
    updatedAt: (item.updatedAt as string) ?? new Date().toISOString(),
  }))

  return ok({ sessionId, users })
}
