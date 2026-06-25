import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Plus, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react'
import { createUserFn, deleteUserFn, listUsersFn } from '../../fn/users'
import { Alert, Button, Field, IconButton, Modal, RoleBadge, EmptyState } from '../../components/ui'
import { ROLES, ROLE_LABELS } from '../../types'
import type { PublicUser, Role } from '../../types'
import { formatRelative } from '../../lib/format'
import { errorMessage } from '../../lib/errors'

export const Route = createFileRoute('/dashboard/users')({
  loader: () => listUsersFn(),
  component: UsersPage,
})

function UsersPage() {
  const users = Route.useLoaderData()
  const { user: current } = Route.useRouteContext()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<PublicUser | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setBanner(null)
    try {
      await deleteUserFn({ data: { id: deleting.id } })
      setDeleting(null)
      await router.invalidate()
    } catch (err) {
      setBanner(errorMessage(err, 'Could not delete user.'))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            {users.length} account{users.length === 1 ? '' : 's'} · manage access and roles
          </p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <UserPlus size={16} />
          Add user
        </Button>
      </div>

      {banner && <Alert variant="danger">{banner}</Alert>}

      <div className="surface overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon={<UsersIcon size={26} />} title="No users" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Last sign-in</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">
                      {u.email ?? u.username}
                      {u.id === current.id && (
                        <span className="badge" style={{ marginLeft: 8 }}>
                          you
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-soft)' }}>{u.name}</td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td style={{ color: 'var(--text-soft)' }} suppressHydrationWarning>
                      {formatRelative(u.createdAt)}
                    </td>
                    <td style={{ color: 'var(--text-soft)' }} suppressHydrationWarning>
                      {formatRelative(u.lastLoginAt)}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <IconButton
                          label="Delete user"
                          onClick={() => setDeleting(u)}
                          disabled={u.id === current.id}
                        >
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

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false)
            await router.invalidate()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete user"
          onClose={() => (deleteBusy ? undefined : setDeleting(null))}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleteBusy}>
                Delete user
              </Button>
            </>
          }
        >
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
            Remove <strong style={{ color: 'var(--text)' }}>{deleting.email ?? deleting.username}</strong>?
            They will lose all access immediately.
          </p>
        </Modal>
      )}
    </div>
  )
}

function AddUserModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createUserFn({ data: { email, name, role } })
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Could not add user.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Add user"
      description="Grant access to a Google account. They sign in with Google — no password is set."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-user-form" variant="primary" loading={saving}>
            <Plus size={16} />
            Add user
          </Button>
        </>
      }
    >
      <form id="add-user-form" onSubmit={submit} className="grid gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <Field
          label="Google email"
          htmlFor="u-email"
          hint="The Gmail / Google Workspace address they sign in with"
        >
          <input
            id="u-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@gmail.com"
            autoComplete="off"
            autoFocus
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="u-name">
            <input
              id="u-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </Field>
          <Field label="Role" htmlFor="u-role">
            <select
              id="u-role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          <strong>Admin</strong> manages users &amp; audit · <strong>Editor</strong> creates/edits
          secrets · <strong>Viewer</strong> reads &amp; reveals only.
        </p>
      </form>
    </Modal>
  )
}
