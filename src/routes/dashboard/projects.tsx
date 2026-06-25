import { useMemo, useState } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import {
  ArrowRight,
  FolderOpen,
  FolderPlus,
  KeyRound,
  Pencil,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react'
import { deleteProjectFn, listProjectsFn } from '../../fn/projects'
import { listUsersFn } from '../../fn/users'
import { ProjectForm } from '../../components/ProjectForm'
import { Alert, Button, EmptyState, IconButton, Modal } from '../../components/ui'
import { ROLE_CAN } from '../../types'
import type { PublicProject } from '../../types'
import { errorMessage } from '../../lib/errors'
import { formatRelative } from '../../lib/format'

export const Route = createFileRoute('/dashboard/projects')({
  beforeLoad: ({ context }) => {
    if (!ROLE_CAN.administer(context.user.role)) throw redirect({ to: '/dashboard' })
  },
  loader: async () => {
    const [projects, users] = await Promise.all([listProjectsFn(), listUsersFn()])
    return { projects, users }
  },
  component: ProjectsPage,
})

type Editing = { mode: 'create' } | { mode: 'edit'; project: PublicProject }

function ProjectsPage() {
  const { projects, users } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  function openProject(id: string) {
    navigate({ to: '/dashboard', search: { project: id } })
  }
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<PublicProject | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const usernameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) m.set(u.id, u.username)
    return m
  }, [users])

  function memberLabel(p: PublicProject): string {
    const names = p.memberIds.map((id) => usernameById.get(id)).filter((n): n is string => !!n)
    if (names.length === 0) return 'Admins only'
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setBanner(null)
    try {
      await deleteProjectFn({ data: { id: deleting.id } })
      setDeleting(null)
      await router.invalidate()
    } catch (err) {
      setBanner(errorMessage(err, 'Could not delete the project.'))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            {projects.length} project{projects.length === 1 ? '' : 's'} · control who can access which
            secrets
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
          <FolderPlus size={16} />
          New project
        </Button>
      </div>

      {banner && <Alert variant="danger">{banner}</Alert>}

      <div className="surface overflow-hidden">
        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={26} />}
            title="No projects yet"
            description="Create a project to group secrets and control who can access them."
            action={
              <Button variant="primary" onClick={() => setEditing({ mode: 'create' })}>
                <FolderPlus size={16} />
                New project
              </Button>
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Members</th>
                  <th>Secrets</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openProject(p.id)}
                    style={{ cursor: 'pointer' }}
                    title={`Open ${p.name}`}
                  >
                    <td>
                      <div className="font-medium" style={{ color: 'var(--accent-soft)' }}>
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="mt-0.5 text-xs" style={{ color: 'var(--text-faint)' }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-soft)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <UsersIcon size={13} />
                        {memberLabel(p)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-soft)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound size={13} />
                        {p.secretCount ?? 0}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-soft)' }} suppressHydrationWarning>
                      {formatRelative(p.createdAt)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton label="Open project" onClick={() => openProject(p.id)}>
                          <ArrowRight size={16} />
                        </IconButton>
                        <IconButton
                          label="Edit project"
                          onClick={() => setEditing({ mode: 'edit', project: p })}
                        >
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton label="Delete project" onClick={() => setDeleting(p)}>
                          <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ProjectForm
          mode={editing.mode}
          project={editing.mode === 'edit' ? editing.project : undefined}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={async (saved) => {
            const wasCreate = editing.mode === 'create'
            setEditing(null)
            // Drop the admin straight into a freshly created project so they can
            // start adding secrets; edits just refresh the list in place.
            if (wasCreate) {
              await navigate({ to: '/dashboard', search: { project: saved.id } })
            } else {
              await router.invalidate()
            }
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete project"
          onClose={() => (deleteBusy ? undefined : setDeleting(null))}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleteBusy}>
                Delete project
              </Button>
            </>
          }
        >
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
            Delete <strong style={{ color: 'var(--text)' }}>{deleting.name}</strong> and its{' '}
            <strong style={{ color: 'var(--text)' }}>{deleting.secretCount ?? 0}</strong> secret
            {(deleting.secretCount ?? 0) === 1 ? '' : 's'}? This permanently removes the project and
            every secret inside it, and cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
