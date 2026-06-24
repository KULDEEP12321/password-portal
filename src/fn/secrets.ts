/**
 * Secret CRUD server functions. Every function authenticates first; writes
 * require admin/editor; reveals are rate-limited and audited.
 */
import { createServerFn } from '@tanstack/react-start'
import { getActorContext, requireUser } from '../server/session'
import {
  createSecret,
  deleteSecret,
  getSecretMeta,
  listSecrets,
  revealSecret,
  updateSecret,
} from '../server/secrets'
import { writeAudit } from '../server/audit'
import { enforceRateLimit } from '../server/ratelimit'
import { idSchema, secretInputSchema, updateSecretSchema } from '../server/schemas'
import type { RevealResult, SecretMeta } from '../types'

const WRITE_ROLES = ['admin', 'editor'] as const

export const listSecretsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SecretMeta[]> => {
    await requireUser()
    return listSecrets()
  },
)

export const revealSecretFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<RevealResult> => {
    const user = await requireUser()
    const { ip, userAgent } = getActorContext()

    // Reveals are sensitive: cap how many a single user can perform per minute.
    enforceRateLimit(`reveal:${user.id}`, 60, 60_000, 'Too many reveals. Please slow down.')

    const meta = await getSecretMeta(data.id)
    const result = await revealSecret(data.id)
    await writeAudit({
      actor: user.username,
      actorId: user.id,
      action: 'secret.reveal',
      targetId: meta.id,
      targetName: meta.name,
      ip,
      userAgent,
    })
    return result
  })

export const createSecretFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => secretInputSchema.parse(d))
  .handler(async ({ data }): Promise<SecretMeta> => {
    const user = await requireUser([...WRITE_ROLES])
    const { ip, userAgent } = getActorContext()
    const meta = await createSecret(data, user.username)
    await writeAudit({
      actor: user.username,
      actorId: user.id,
      action: 'secret.create',
      targetId: meta.id,
      targetName: meta.name,
      ip,
      userAgent,
    })
    return meta
  })

export const updateSecretFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => updateSecretSchema.parse(d))
  .handler(async ({ data }): Promise<SecretMeta> => {
    const user = await requireUser([...WRITE_ROLES])
    const { ip, userAgent } = getActorContext()
    const { id, ...input } = data
    const meta = await updateSecret(id, input, user.username)
    await writeAudit({
      actor: user.username,
      actorId: user.id,
      action: 'secret.update',
      targetId: meta.id,
      targetName: meta.name,
      ip,
      userAgent,
    })
    return meta
  })

export const deleteSecretFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const user = await requireUser([...WRITE_ROLES])
    const { ip, userAgent } = getActorContext()
    const meta = await deleteSecret(data.id)
    await writeAudit({
      actor: user.username,
      actorId: user.id,
      action: 'secret.delete',
      targetId: meta.id,
      targetName: meta.name,
      ip,
      userAgent,
    })
    return { ok: true }
  })
