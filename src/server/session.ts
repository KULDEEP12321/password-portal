/**
 * Session + access control.
 *
 * Sessions use TanStack Start's sealed-cookie session: the cookie is encrypted
 * and signed with SESSION_PASSWORD, httpOnly, and (in production) Secure. The
 * cookie stores only the user id/username/role — never the password or secrets.
 */
import {
  useSession,
  getRequest,
  getRequestIP,
  getRequestHeader,
} from '@tanstack/react-start/server'
import { getEnv } from './env'
import { Errors } from './errors'
import { getUserByUsername, toPublicUser } from './users'
import type { PublicUser, Role } from '../types'

export interface SessionData {
  userId: string
  username: string
  role: Role
  loginAt: number
}

export function getAppSession() {
  const env = getEnv()
  return useSession<SessionData>({
    password: env.sessionPassword,
    name: env.sessionName,
    maxAge: env.sessionMaxAgeSec,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.cookieSecure,
      path: '/',
    },
  })
}

/** Resolve the signed-in user from the session, re-validating against storage. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await getAppSession()
  const data = session.data
  if (!data?.userId || !data.username) return null

  // Single-GET lookup by the immutable username key — re-validates against
  // storage (deleted / role-changed accounts reflected immediately) without
  // scanning every user record on each request.
  const user = await getUserByUsername(data.username)
  if (!user || user.id !== data.userId) {
    await session.clear()
    return null
  }
  return toPublicUser(user)
}

/** Require an authenticated user, optionally with one of the given roles. */
export async function requireUser(roles?: Role[]): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) throw Errors.unauthorized()
  if (roles && !roles.includes(user.role)) throw Errors.forbidden()
  return user
}

/** Best-effort request metadata for audit logging / rate limiting. */
export function getActorContext(): { ip: string; userAgent: string } {
  let ip = 'unknown'
  try {
    // On Cloudflare the true client IP is in CF-Connecting-IP (set by the edge,
    // not client-spoofable). Fall back to X-Forwarded-For only when
    // TRUST_PROXY=true, otherwise the non-spoofable socket address.
    ip =
      getRequest().headers.get('cf-connecting-ip') ??
      getRequestIP({ xForwardedFor: getEnv().trustProxy }) ??
      'unknown'
  } catch {
    /* not in a request context */
  }
  let userAgent = 'unknown'
  try {
    userAgent = getRequestHeader('user-agent') ?? 'unknown'
  } catch {
    /* ignore */
  }
  return { ip, userAgent }
}
