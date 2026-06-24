/**
 * Authentication server functions: who-am-I, login, logout.
 * These compile to secure POST/GET endpoints; the handler body runs only on the
 * server and is stripped from the client bundle.
 */
import { createServerFn } from '@tanstack/react-start'
import { getActorContext, getAppSession, getCurrentUser, requireUser } from '../server/session'
import {
  ensureBootstrap,
  getUserByUsername,
  markLogin,
  setUserPassword,
  toPublicUser,
  verifyCredentials,
} from '../server/users'
import { writeAudit } from '../server/audit'
import { enforceRateLimit } from '../server/ratelimit'
import { Errors } from '../server/errors'
import { changePasswordSchema, loginSchema } from '../server/schemas'
import type { PublicUser } from '../types'

export const meFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PublicUser | null> => {
    // The auth probe must never throw: a transient storage error (e.g. an R2 blip
    // on a cold isolate) should land the user on /login, not crash the route tree.
    try {
      await ensureBootstrap()
      return await getCurrentUser()
    } catch (err) {
      console.error('[meFn] failed to resolve current user:', err)
      return null
    }
  },
)

export const loginFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }): Promise<PublicUser> => {
    await ensureBootstrap()
    const { ip, userAgent } = getActorContext()

    // Throttle brute-force attempts per source IP...
    enforceRateLimit(
      `login:${ip}`,
      10,
      5 * 60_000,
      'Too many sign-in attempts. Please wait a few minutes and try again.',
    )
    // ...and per target account + globally, so the throttle holds even if the
    // source IP is shared or (behind an untrusted proxy) spoofable.
    enforceRateLimit(
      `login-user:${data.username.toLowerCase()}`,
      10,
      5 * 60_000,
      'Too many sign-in attempts for this account. Please wait a few minutes.',
    )
    enforceRateLimit('login-global', 100, 60_000, 'The sign-in service is busy. Please try again shortly.')

    const user = await getUserByUsername(data.username)
    const ok = await verifyCredentials(user, data.password)
    if (!user || !ok) {
      await writeAudit({
        actor: data.username,
        action: 'login_failed',
        ip,
        userAgent,
        success: false,
        detail: 'Invalid credentials',
      })
      throw Errors.unauthorized('Invalid username or password.')
    }

    const session = await getAppSession()
    // Clear any prior session state before establishing the authenticated
    // identity (explicit no-fixation guarantee).
    await session.clear()
    await session.update({
      userId: user.id,
      username: user.username,
      role: user.role,
      loginAt: Date.now(),
    })
    await markLogin(user)
    await writeAudit({
      actor: user.username,
      actorId: user.id,
      action: 'login',
      ip,
      userAgent,
    })
    return toPublicUser(user)
  })

export const changePasswordFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => changePasswordSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const current = await requireUser()
    const { ip, userAgent } = getActorContext()

    // Verify the current password before allowing a change.
    const record = await getUserByUsername(current.username)
    const ok = await verifyCredentials(record, data.currentPassword)
    if (!record || !ok) {
      await writeAudit({
        actor: current.username,
        actorId: current.id,
        action: 'user.password',
        ip,
        userAgent,
        success: false,
        detail: 'Incorrect current password',
      })
      throw Errors.badRequest('Your current password is incorrect.')
    }

    await setUserPassword(record, data.newPassword)
    await writeAudit({
      actor: current.username,
      actorId: current.id,
      action: 'user.password',
      targetId: record.id,
      targetName: record.username,
      ip,
      userAgent,
    })
    return { ok: true }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { ip, userAgent } = getActorContext()
  const current = await getCurrentUser()
  const session = await getAppSession()
  await session.clear()
  if (current) {
    await writeAudit({
      actor: current.username,
      actorId: current.id,
      action: 'logout',
      ip,
      userAgent,
    })
  }
  return { ok: true }
})
