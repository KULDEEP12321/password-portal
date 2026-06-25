import { useMemo, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Eraser, ScrollText, Search, ShieldAlert } from 'lucide-react'
import { clearAuditFn, listAuditFn } from '../../fn/audit'
import { Alert, Button, EmptyState, Modal } from '../../components/ui'
import { AUDIT_ACTION_LABELS } from '../../types'
import type { AuditAction } from '../../types'
import { formatDateTime } from '../../lib/format'
import { errorMessage } from '../../lib/errors'

export const Route = createFileRoute('/dashboard/audit')({
  loader: () => listAuditFn(),
  component: AuditPage,
})

const ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]

function AuditPage() {
  const { entries, truncated } = Route.useLoaderData()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [action, setAction] = useState<AuditAction | 'all'>('all')
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  async function clearLog() {
    setClearing(true)
    setBanner(null)
    try {
      await clearAuditFn()
      setConfirmClear(false)
      await router.invalidate()
    } catch (err) {
      setBanner(errorMessage(err, 'Could not clear the audit log.'))
    } finally {
      setClearing(false)
    }
  }

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            Access and modification history · {entries.length} most recent events
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => setConfirmClear(true)}
          disabled={entries.length === 0}
          title="Clear the audit log"
        >
          <Eraser size={16} />
          Clear log
        </Button>
      </div>

      {banner && <Alert variant="danger">{banner}</Alert>}

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
                  <tr key={e.id}>
                    <td
                      style={{ whiteSpace: 'nowrap', color: 'var(--text-soft)' }}
                      suppressHydrationWarning
                    >
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

      {confirmClear && (
        <Modal
          title="Clear audit log"
          onClose={() => (clearing ? undefined : setConfirmClear(false))}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmClear(false)} disabled={clearing}>
                Cancel
              </Button>
              <Button variant="danger" onClick={clearLog} loading={clearing}>
                Clear log
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              Permanently delete all{' '}
              <strong style={{ color: 'var(--text)' }}>{entries.length}</strong> audit entries? This
              cannot be undone. A single record noting that you cleared the log (with your name and
              the time) will remain for accountability.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
