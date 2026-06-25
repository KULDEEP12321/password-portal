import { useState } from 'react'
import { Alert, Button, Field, Modal, RoleBadge } from './ui'
import type { PublicProject, PublicUser } from '../types'
import { createProjectFn, updateProjectFn } from '../fn/projects'
import { errorMessage } from '../lib/errors'

export function ProjectForm({
  mode,
  project,
  users,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  project?: PublicProject
  users: PublicUser[]
  onClose: () => void
  onSaved: (project: PublicProject) => void | Promise<void>
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [memberIds, setMemberIds] = useState<string[]>(project?.memberIds ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Admins always have access, so only non-admins are choosable members.
  const selectable = users.filter((u) => u.role !== 'admin')

  function toggleMember(id: string) {
    setMemberIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Project name is required.')
    setSaving(true)
    try {
      const base = { name: name.trim(), description: description.trim(), memberIds }
      const saved =
        mode === 'create'
          ? await createProjectFn({ data: base })
          : await updateProjectFn({ data: { ...base, id: project!.id } })
      await onSaved(saved)
    } catch (err) {
      setError(errorMessage(err, 'Could not save the project.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? 'New project' : 'Edit project'}
      description="Members — plus all admins — can see and use this project's secrets."
      onClose={onClose}
      wide
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" variant="primary" loading={saving}>
            {mode === 'create' ? 'Create project' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="grid gap-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <Field label="Project name" htmlFor="p-name">
          <input
            id="p-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Mobile App"
            autoFocus
            maxLength={120}
          />
        </Field>

        <Field label="Description" htmlFor="p-desc" hint="Optional">
          <input
            id="p-desc"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this project is for"
            maxLength={500}
          />
        </Field>

        <Field
          label="Members"
          hint="Admins always have access. Choose which other users can access this project."
        >
          {selectable.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
              No non-admin users yet. Create users on the Users page, then add them here.
            </p>
          ) : (
            <div className="grid gap-1.5" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {selectable.map((u) => (
                <label key={u.id} className="opt-row">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                  />
                  <span style={{ fontWeight: 600 }}>{u.username}</span>
                  <span className="text-sm" style={{ color: 'var(--text-soft)' }}>
                    {u.name}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    <RoleBadge role={u.role} />
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>
      </form>
    </Modal>
  )
}
