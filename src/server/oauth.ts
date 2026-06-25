/**
 * Google OAuth 2.0 (Authorization Code flow), implemented for the Workers
 * runtime. The flow:
 *   1. /auth/google/start  -> redirect the browser to Google with a CSRF `state`.
 *   2. Google redirects back to /auth/google/callback?code=...&state=...
 *   3. We exchange the code for tokens server-to-server (over TLS), read the
 *      verified email from the returned ID token, and match it to an allowlisted
 *      user. The ID token is trusted because it comes directly from Google's
 *      token endpoint on a server-to-server TLS connection (no separate JWKS
 *      verification needed for the code-exchange response).
 */
import { Buffer } from 'node:buffer'
import { getEnv } from './env'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export interface GoogleIdentity {
  email: string
  emailVerified: boolean
  name?: string
  sub: string
}

function requireGoogle() {
  const google = getEnv().google
  if (!google) {
    throw new Error('Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).')
  }
  return google
}

export function buildGoogleAuthUrl(opts: { state: string; redirectUri: string }): string {
  const { clientId } = requireGoogle()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: opts.state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const segment = jwt.split('.')[1]
  if (!segment) throw new Error('Malformed ID token.')
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

/** Exchange the authorization code for the user's verified Google identity. */
export async function exchangeCodeForIdentity(opts: {
  code: string
  redirectUri: string
}): Promise<GoogleIdentity> {
  const { clientId, clientSecret } = requireGoogle()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
  })

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as { id_token?: string }
  if (!data.id_token) throw new Error('Google did not return an id_token.')

  const p = decodeJwtPayload(data.id_token) as {
    email?: string
    email_verified?: boolean | string
    name?: string
    sub?: string
  }
  if (!p.email || !p.sub) throw new Error('Google id_token is missing email or sub.')

  return {
    email: p.email.toLowerCase(),
    emailVerified: p.email_verified === true || p.email_verified === 'true',
    name: p.name,
    sub: p.sub,
  }
}
