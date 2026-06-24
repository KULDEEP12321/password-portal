/** User-management server functions. Admin only. */
import { createServerFn } from '@tanstack/react-start'
import { getActorContext, requireUser } from '../server/session'
import {
  createUser,
  deleteUserById,
  getUserByUsername,
  listUserRecords,
  toPublicUser,
} from '../server/users'
import { writeAudit } from '../server/audit'
import { Errors } from '../server/errors'
import { createUserSchema, idSchema } from '../server/schemas'
import type { PublicUser } from '../types'

export const listUsersFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PublicUser[]> => {
    await requireUser(['admin'])
    const users = await listUserRecords()
    return users
      .map(toPublicUser)
      .sort((a, b) => a.username.localeCompare(b.username))
  },
)

export const createUserFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data }): Promise<PublicUser> => {
    const admin = await requireUser(['admin'])
    const { ip, userAgent } = getActorContext()

    if (await getUserByUsername(data.username)) {
      throw Errors.conflict(`A user named "${data.username}" already exists.`)
    }

    const user = await createUser(data)
    await writeAudit({
      actor: admin.username,
      actorId: admin.id,
      action: 'user.create',
      targetId: user.id,
      targetName: user.username,
      ip,
      userAgent,
      detail: `role=${user.role}`,
    })
    return toPublicUser(user)
  })

export const deleteUserFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const admin = await requireUser(['admin'])
    const { ip, userAgent } = getActorContext()

    if (data.id === admin.id) {
      throw Errors.badRequest('You cannot delete your own account.')
    }

    const users = await listUserRecords()
    const target = users.find((u) => u.id === data.id)
    if (!target) throw Errors.notFound('User not found.')

    // Never allow removing the last remaining admin.
    const adminCount = users.filter((u) => u.role === 'admin').length
    if (target.role === 'admin' && adminCount <= 1) {
      throw Errors.badRequest('Cannot delete the last remaining admin.')
    }

    await deleteUserById(target.id)
    await writeAudit({
      actor: admin.username,
      actorId: admin.id,
      action: 'user.delete',
      targetId: target.id,
      targetName: target.username,
      ip,
      userAgent,
    })
    return { ok: true }
  })
