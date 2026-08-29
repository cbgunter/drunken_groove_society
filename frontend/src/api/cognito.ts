import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider'

const REGION = import.meta.env.VITE_AWS_REGION ?? 'us-east-1'
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID ?? ''

const client = new CognitoIdentityProviderClient({ region: REGION })

export interface TokenSet {
  idToken: string
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms, from the ID token's exp claim
}

export interface IdClaims {
  sub: string
  name: string
  exp: number
}

export type LoginResult =
  | { kind: 'tokens'; tokens: TokenSet }
  | { kind: 'newPasswordRequired'; session: string; username: string }

function ensureConfigured() {
  if (!CLIENT_ID) {
    throw new Error('Sign-in is not configured for this build (missing VITE_COGNITO_CLIENT_ID).')
  }
}

// Decodes the ID token payload only — no signature verification client-side.
// The API Gateway JWT authorizer is the actual trust boundary; this is just
// for reading the claims we already trust the token to carry.
export function decodeIdToken(idToken: string): IdClaims {
  const payload = idToken.split('.')[1] ?? ''
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  const claims = JSON.parse(json) as Record<string, unknown>
  return {
    sub: String(claims.sub ?? ''),
    name: String(claims.name ?? claims['cognito:username'] ?? ''),
    exp: Number(claims.exp ?? 0),
  }
}

function toTokenSet(result: AuthenticationResultType, fallbackRefreshToken?: string): TokenSet {
  const idToken = result.IdToken
  const accessToken = result.AccessToken
  if (!idToken || !accessToken) throw new Error('Sign-in did not return tokens.')
  const claims = decodeIdToken(idToken)
  return {
    idToken,
    accessToken,
    refreshToken: result.RefreshToken ?? fallbackRefreshToken ?? '',
    expiresAt: claims.exp * 1000,
  }
}

function friendlyError(err: unknown): Error {
  const name = (err as { name?: string } | undefined)?.name
  switch (name) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return new Error('Wrong name or password.')
    case 'PasswordResetRequiredException':
      return new Error('Your password needs to be reset — ask Casey.')
    case 'TooManyRequestsException':
    case 'LimitExceededException':
      return new Error('Too many attempts — wait a minute and try again.')
    default:
      return err instanceof Error ? err : new Error('Sign-in failed.')
  }
}

export async function login(username: string, password: string): Promise<LoginResult> {
  ensureConfigured()
  try {
    const res = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      }),
    )
    if (res.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      if (!res.Session) throw new Error('Sign-in requires a new password, but no session was returned.')
      return {
        kind: 'newPasswordRequired',
        session: res.Session,
        // Canonical username can differ from what was typed under
        // case-insensitive usernames — Cognito requires it in the challenge response.
        username: res.ChallengeParameters?.USER_ID_FOR_SRP ?? username,
      }
    }
    if (!res.AuthenticationResult) throw new Error('Sign-in did not return an authentication result.')
    return { kind: 'tokens', tokens: toTokenSet(res.AuthenticationResult) }
  } catch (err) {
    throw friendlyError(err)
  }
}

export async function completeNewPassword(
  username: string,
  newPassword: string,
  session: string,
): Promise<TokenSet> {
  ensureConfigured()
  try {
    const res = await client.send(
      new RespondToAuthChallengeCommand({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: CLIENT_ID,
        Session: session,
        ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
      }),
    )
    if (!res.AuthenticationResult) throw new Error('Password change did not return an authentication result.')
    return toTokenSet(res.AuthenticationResult)
  } catch (err) {
    throw friendlyError(err)
  }
}

// Cognito's refresh flow does not return a new refresh token — the caller
// keeps using the one it already has.
export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  ensureConfigured()
  try {
    const res = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    )
    if (!res.AuthenticationResult) throw new Error('Refresh did not return an authentication result.')
    return toTokenSet(res.AuthenticationResult, refreshToken)
  } catch (err) {
    throw friendlyError(err)
  }
}
