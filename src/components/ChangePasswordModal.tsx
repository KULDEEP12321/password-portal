import { useState } from 'react'
import { Alert, Button, Field, Modal } from './ui'
import { changePasswordFn } from '../fn/auth'
import { errorMessage } from '../lib/errors'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('New passwords do not match.')
    setSaving(true)
    try {
      await changePasswordFn({ data: { currentPassword: current, newPassword: next } })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, 'Could not change password.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Change password"
      description="Set a new password for your account."
      onClose={onClose}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="change-password-form" variant="primary" loading={saving}>
              Update password
            </Button>
          </>
        )
      }
    >
      {done ? (
        <Alert variant="success">
          Password updated. Use your new password the next time you sign in.
        </Alert>
      ) : (
        <form id="change-password-form" onSubmit={submit} className="grid gap-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <Field label="Current password" htmlFor="cp-current">
            <input
              id="cp-current"
              type="password"
              className="input"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
          <Field label="New password" htmlFor="cp-next" hint="At least 8 characters">
            <input
              id="cp-next"
              type="password"
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="cp-confirm">
            <input
              id="cp-confirm"
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </form>
      )}
    </Modal>
  )
}
