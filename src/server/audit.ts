/**
 * Append-only audit log. Each entry is a single immutable object stored under
 * the `audit/` prefix, keyed by ISO timestamp so lexical ordering == chronological
 * ordering. Writes are best-effort: a logging failure must never block or fail
 * the underlying user action.
 */
import { randomUUID } from 'node:crypto'
import { delKey, getJson, listKeys, putJson } from './db'
import type { AuditAction, AuditEntry } from '../types'

const PREFIX = 'audit/'

export interface AuditInput {
  actor: string
  actorId?: string
  action: AuditAction
  targetId?: string
  targetName?: string
  ip?: string
  userAgent?: string
  success?: boolean
  detail?: string
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const at = new Date().toISOString()
    const id = randomUUID()
    const entry: AuditEntry = {
      id,
      at,
      actor: input.actor,
      actorId: input.actorId,
      action: input.action,
      targetId: input.targetId,
      targetName: input.targetName,
      ip: input.ip,
      userAgent: input.userAgent,
      success: input.success ?? true,
      detail: input.detail,
    }
    // `${at}__${id}` keeps keys unique and chronologically sortable.
    await putJson(`${PREFIX}${at}__${id}.json`, entry)
  } catch (err) {
    // Never let auditing break the primary operation.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write audit entry', err)
  }
}

export interface AuditQuery {
  limit?: number
  action?: AuditAction
  actor?: string
  targetId?: string
}

/**
 * Returns the most recent audit entries (newest first). Reads at most `scan`
 * objects to bound cost; for high-volume deployments move audit to a queryable
 * store. The cap is surfaced to callers via the `truncated` flag.
 */
export async function listAudit(
  query: AuditQuery = {},
): Promise<{ entries: AuditEntry[]; truncated: boolean }> {
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 1000)

  const objects = await listKeys(PREFIX)
  // Keys sort chronologically; reverse for newest-first.
  objects.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
  const truncated = objects.length > limit
  // Only fetch the newest `limit` records to bound R2 round-trips per request.
  const candidates = objects.slice(0, limit)

  const loaded = await Promise.all(candidates.map((o) => getJson<AuditEntry>(o.key)))
  let entries = loaded.filter((e): e is AuditEntry => e != null)

  if (query.action) entries = entries.filter((e) => e.action === query.action)
  if (query.actor) entries = entries.filter((e) => e.actor === query.actor)
  if (query.targetId) entries = entries.filter((e) => e.targetId === query.targetId)

  return { entries, truncated }
}

/** Permanently delete every audit entry. Returns the number removed. */
export async function clearAudit(): Promise<number> {
  const objects = await listKeys(PREFIX)
  await Promise.all(objects.map((o) => delKey(o.key)))
  return objects.length
}
