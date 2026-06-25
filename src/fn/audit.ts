/** Audit-log server function. Admin only. */
import { createServerFn } from '@tanstack/react-start'
import { getActorContext, requireUser } from '../server/session'
import { clearAudit, listAudit, writeAudit } from '../server/audit'
import type { AuditEntry } from '../types'

export const listAuditFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ entries: AuditEntry[]; truncated: boolean }> => {
    await requireUser(['admin'])
    const { entries, truncated } = await listAudit({ limit: 300 })
    // Project to only the fields the client renders/searches — keep the
    // fingerprintable userAgent and internal actorId server-side.
    const projected: AuditEntry[] = entries.map((e) => ({
      id: e.id,
      at: e.at,
      actor: e.actor,
      action: e.action,
      targetId: e.targetId,
      targetName: e.targetName,
      ip: e.ip,
      success: e.success,
      detail: e.detail,
    }))
    return { entries: projected, truncated }
  },
)

export const clearAuditFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ ok: true; deleted: number }> => {
    const admin = await requireUser(['admin'])
    const { ip, userAgent } = getActorContext()
    const deleted = await clearAudit()
    // Always leave a trace that the log was cleared, for accountability.
    await writeAudit({
      actor: admin.username,
      actorId: admin.id,
      action: 'audit.clear',
      ip,
      userAgent,
      detail: `Cleared ${deleted} audit ${deleted === 1 ? 'entry' : 'entries'}`,
    })
    return { ok: true, deleted }
  },
)
