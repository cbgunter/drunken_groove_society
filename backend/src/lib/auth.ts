import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { err } from './cors'

export interface Caller {
  userId: string // Cognito sub — the only value ever used as a key
  userName: string // 'name' claim — display + Entry.selector matching only, never an auth decision
}

export type AuthedEvent = APIGatewayProxyEventV2WithJWTAuthorizer

function claimString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function getCaller(event: AuthedEvent): Caller | null {
  const claims = event.requestContext.authorizer?.jwt?.claims
  const userId = claimString(claims?.sub)
  if (!userId) return null
  const userName = claimString(claims?.name) || claimString(claims?.['cognito:username'])
  return { userId, userName }
}

// Defense in depth — the HttpApi JWT authorizer already rejects
// unauthenticated requests before a handler ever runs. This matters if the
// authorizer is ever detached during a rollback, and matters most on
// lookup/generateSummary/sendSummary, which spend Anthropic tokens and SES
// quota per call.
export function withAuth(
  fn: (event: AuthedEvent, caller: Caller) => Promise<APIGatewayProxyResultV2>,
) {
  return async (event: AuthedEvent): Promise<APIGatewayProxyResultV2> => {
    const caller = getCaller(event)
    if (!caller) return err('Unauthorized', 401)
    return fn(event, caller)
  }
}
