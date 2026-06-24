import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ScrollText, Search } from 'lucide-react'
import { listAuditFn } from '../../fn/audit'
import { Alert, EmptyState } from '../../components/ui'
import { AUDIT_ACTION_LABELS } from '../../types'
import type { AuditAction } from '../../types'
import { formatDateTime } from '../../lib/format'

export const Route = createFileRoute('/dashboard/audit')({
  loader: () => listAuditFn(),
  component: AuditPage,
})

const ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]

function AuditPage() {
  const { entries, truncated } = Route.useLoaderData()
  const [search, setSearch] = useState('')
  const [action, setAction] = useState<AuditAction | 'all'>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((e) => {
      if (action !== 'all' && e.action !== action) return false
      if (!q) return true
      return [e.actor, e.targetName, e.ip, e.detail]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [entries, search, action])

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
          Access and modification history · {entries.length} most recent events
        </p>
      </div>

      {truncated && (
        <Alert variant="info">
          Showing the most recent events only. Older entries exist in storage but are not loaded here.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-faint)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search actor, target, IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ maxWidth: 200 }}
          value={action}
          onChange={(e) => setAction(e.target.value as AuditAction | 'all')}
        >
          <option value="all">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {AUDIT_ACTION_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      <div className="surface overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={26} />}
            title="No events"
            description="Nothing matches the current filters."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>IP</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="fade-in">
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-soft)' }}>
                      {formatDateTime(e.at)}
                    </td>
                    <td className="font-medium">{e.actor}</td>
                    <td>{AUDIT_ACTION_LABELS[e.action] ?? e.action}</td>
                    <td style={{ color: 'var(--text-soft)' }}>{e.targetName ?? '—'}</td>
                    <td className="mono" style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>
                      {e.ip ?? '—'}
                    </td>
                    <td>
                      <span className={e.success ? 'badge badge-success' : 'badge badge-danger'}>
                        {e.success ? 'OK' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
