import { useMemo, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { KeyRound, Plus, Search, ShieldAlert } from 'lucide-react'
import { listSecretsFn, deleteSecretFn, revealSecretFn } from '../../fn/secrets'
import { SecretRow } from '../../components/SecretRow'
import { SecretForm } from '../../components/SecretForm'
import { Alert, Button, EmptyState, Modal, cn } from '../../components/ui'
import { ROLE_CAN, SECRET_TYPES } from '../../types'
import type { RevealResult, SecretMeta, SecretType } from '../../types'
import { errorMessage } from '../../lib/errors'

export const Route = createFileRoute('/dashboard/')({
  loader: () => listSecretsFn(),
  component: SecretsPage,
})

type Editing =
  | { mode: 'create' }
  | { mode: 'edit'; meta: SecretMeta; reveal: RevealResult }

function SecretsPage() {
  const secrets = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const canWrite = ROLE_CAN.write(user.role)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<SecretType | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<SecretMeta | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const s of secrets) s.tags.forEach((t) => set.add(t))
    return [...set].sort()
  }, [secrets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return secrets.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (tagFilter && !s.tags.includes(tagFilter)) return false
      if (!q) return true
      const haystack = [s.name, s.username, s.url, ...s.tags].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [secrets, search, typeFilter, tagFilter])

  async function refresh() {
    await router.invalidate()
  }

  async function startEdit(secret: SecretMeta) {
    setBanner(null)
    try {
      const reveal = await revealSecretFn({ data: { id: secret.id } })
      setEditing({ mode: 'edit', meta: secret, reveal })
    } catch (err) {
      setBanner(errorMessage(err, 'Could not open secret for editing.'))
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setBanner(null)
    try {
      await deleteSecretFn({ data: { id: deleting.id } })
      setDeleting(null)
      await refresh()
    } catch (err) {
      setBanner(errorMessage(err, 'Could not delete the secret.'))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Secrets</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            {secrets.length} stored · encrypted at rest with AES-256-GCM
          </p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
            <Plus size={16} />
            New secret
          </Button>
        )}
      </div>

      {banner && <Alert variant="danger">{banner}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-faint)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name, username, URL, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as SecretType | 'all')}
        >
          <option value="all">All types</option>
          {SECRET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className={cn('tag', !tagFilter && 'badge-accent')}
            onClick={() => setTagFilter(null)}
            style={{ cursor: 'pointer' }}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={cn('tag', tagFilter === t && 'badge-accent')}
              onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
              style={{ cursor: 'pointer' }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="surface overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={26} />}
            title={secrets.length === 0 ? 'No secrets yet' : 'No matches'}
            description={
              secrets.length === 0
                ? canWrite
                  ? 'Add your first secret to get started. It will be encrypted before storage.'
                  : 'No secrets have been added yet.'
                : 'Try a different search or filter.'
            }
            action={
              secrets.length === 0 && canWrite ? (
                <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
                  <Plus size={16} />
                  New secret
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Secret</th>
                  <th>Tags</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <SecretRow
                    key={s.id}
                    secret={s}
                    canWrite={canWrite}
                    onEdit={startEdit}
                    onDelete={setDeleting}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <SecretForm
          mode={editing.mode}
          meta={editing.mode === 'edit' ? editing.meta : undefined}
          reveal={editing.mode === 'edit' ? editing.reveal : undefined}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete secret"
          onClose={() => (deleteBusy ? undefined : setDeleting(null))}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleteBusy}>
                Delete permanently
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
              Permanently delete <strong style={{ color: 'var(--text)' }}>{deleting.name}</strong>?
              This removes the encrypted record from storage and cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
