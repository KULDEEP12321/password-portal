import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { FolderOpen, FolderPlus, KeyRound, Plus, Search, ShieldAlert } from 'lucide-react'
import { deleteSecretFn, listSecretsFn, revealSecretFn } from '../../fn/secrets'
import { listProjectsFn } from '../../fn/projects'
import { SecretRow } from '../../components/SecretRow'
import { SecretDetail } from '../../components/SecretDetail'
import { SecretForm } from '../../components/SecretForm'
import { Alert, Button, EmptyState, Modal, cn } from '../../components/ui'
import { ROLE_CAN, SECRET_TYPES } from '../../types'
import type { RevealResult, SecretMeta, SecretType } from '../../types'
import { errorMessage } from '../../lib/errors'

export const Route = createFileRoute('/dashboard/')({
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    project: typeof search.project === 'string' ? search.project : undefined,
  }),
  loaderDeps: ({ search }) => ({ project: search.project }),
  loader: async ({ deps }) => {
    const projects = await listProjectsFn()
    const activeProjectId =
      (deps.project && projects.find((p) => p.id === deps.project)?.id) ??
      projects[0]?.id ??
      null
    const secrets = activeProjectId
      ? await listSecretsFn({ data: { projectId: activeProjectId } })
      : []
    return { projects, activeProjectId, secrets }
  },
  component: SecretsPage,
})

type Editing = { mode: 'create' } | { mode: 'edit'; meta: SecretMeta; reveal: RevealResult }

function SecretsPage() {
  const { projects, activeProjectId, secrets } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate({ from: Route.fullPath })
  const canWrite = ROLE_CAN.write(user.role)
  const isAdmin = ROLE_CAN.administer(user.role)
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<SecretType | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [viewing, setViewing] = useState<SecretMeta | null>(null)
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

  // No accessible projects.
  if (projects.length === 0) {
    return (
      <div className="surface overflow-hidden">
        <EmptyState
          icon={<FolderOpen size={26} />}
          title="No projects yet"
          description={
            isAdmin
              ? 'Create a project to start storing secrets in it.'
              : 'You have not been added to any project yet. Ask an admin to give you access.'
          }
          action={
            isAdmin ? (
              <Link to="/dashboard/projects" className="btn btn-primary">
                <FolderPlus size={16} />
                Manage projects
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen size={20} style={{ color: 'var(--accent-soft)' }} />
            <select
              className="input"
              style={{ maxWidth: 280, fontWeight: 600, fontSize: '1.05rem' }}
              value={activeProjectId ?? ''}
              onChange={(e) => navigate({ search: { project: e.target.value } })}
              aria-label="Select project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            {secrets.length} secret{secrets.length === 1 ? '' : 's'} · encrypted with AES-256-GCM ·{' '}
            {activeProject?.memberIds.length ?? 0} member
            {(activeProject?.memberIds.length ?? 0) === 1 ? '' : 's'}
          </p>
        </div>
        {canWrite && activeProjectId && (
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
            title={secrets.length === 0 ? 'No secrets in this project' : 'No matches'}
            description={
              secrets.length === 0
                ? canWrite
                  ? 'Add the first secret to this project. It will be encrypted before storage.'
                  : 'No secrets have been added to this project yet.'
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
                    onView={setViewing}
                    onEdit={startEdit}
                    onDelete={setDeleting}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && activeProjectId && (
        <SecretForm
          mode={editing.mode}
          projectId={editing.mode === 'edit' ? editing.meta.projectId : activeProjectId}
          meta={editing.mode === 'edit' ? editing.meta : undefined}
          reveal={editing.mode === 'edit' ? editing.reveal : undefined}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      )}

      {viewing && (
        <SecretDetail
          secret={viewing}
          canWrite={canWrite}
          onClose={() => setViewing(null)}
          onEdit={(s) => {
            setViewing(null)
            void startEdit(s)
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
