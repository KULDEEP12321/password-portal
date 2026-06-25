/**
 * Google OAuth server functions.
 *
 * These are invoked from the browser via RPC so that the Set-Cookie headers they
 * emit (the CSRF `state` at start, then the sealed session at finish) are applied
 * by the browser on the fetch response — robust, with no dependency on SSR cookie
 * flushing through a thrown redirect.
 */
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequestUrl, setCookie } from '@tanstack/react-start/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getEnv } from '../server/env'
import { buildGoogleAuthUrl, exchangeCodeForIdentity } from '../server/oauth'
import { getActorContext, getAppSession } from '../server/session'
import { ensureBootstrap, getUserByEmail, markLogin } from '../server/users'
import { writeAudit } from '../server/audit'
import { Errors } from '../server/errors'

const STATE_COOKIE = 'g_oauth_state'

/**
 * The redirect URI must be byte-for-byte identical at the authorize and token
 * steps, and must be registered in the Google Cloud OAuth client. We derive it
 * from the current request origin so it works on localhost and in production
 * without hardcoding.
 */
function callbackRedirectUri(): string {
  return `${new URL(getRequestUrl()).origin}/auth/google/callback`
}

export const startGoogleFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ url: string }> => {
    const env = getEnv()
    if (!env.google) throw Errors.badRequest('oauth_unconfigured')

    const state = randomUUID()
    setCookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax', // sent on the top-level GET navigation back from Google
      secure: env.cookieSecure,
      path: '/',
      maxAge: 600,
    })
    return { url: buildGoogleAuthUrl({ state, redirectUri: callbackRedirectUri() }) }
  },
)

const callbackSchema = z.object({
  code: z.string().min(1).max(4000),
  state: z.string().min(1).max(200),
})

export const finishGoogleFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => callbackSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const env = getEnv()
    if (!env.google) throw Errors.badRequest('oauth_unconfigured')
    await ensureBootstrap()
    const { ip, userAgent } = getActorContext()

    // CSRF: the state echoed by Google must match the cookie we set at start.
    const cookieState = getCookie(STATE_COOKIE)
    if (!cookieState || cookieState !== data.state) {
      throw Errors.badRequest('oauth_state')
    }
    setCookie(STATE_COOKIE, '', { path: '/', maxAge: 0 }) // single-use

    const identity = await exchangeCodeForIdentity({
      code: data.code,
      redirectUri: callbackRedirectUri(),
    })
    if (!identity.emailVerified) throw Errors.badRequest('oauth_unverified')

    // Allowlist check: only an email an admin has added can sign in.
    const user = await getUserByEmail(identity.email)
    if (!user) {
      await writeAudit({
        actor: identity.email,
        action: 'login_failed',
        ip,
        userAgent,
        success: false,
        detail: 'Google account not on the allowlist',
      })
      throw Errors.unauthorized('unauthorized')
    }

    const session = await getAppSession()
    await session.clear() // no-fixation: establish a fresh authenticated session
    await session.update({
      userId: user.id,
      username: user.username,
      role: user.role,
      loginAt: Date.now(),
    })
    await markLogin(user)
    await writeAudit({
      actor: user.email ?? user.username,
      actorId: user.id,
      action: 'login',
      ip,
      userAgent,
      detail: 'via Google',
    })
    return { ok: true }
  })
