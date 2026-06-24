/** Audit-log server function. Admin only. */
import { createServerFn } from '@tanstack/react-start'
import { requireUser } from '../server/session'
import { listAudit } from '../server/audit'
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
