import { useState } from 'react'
import { Eye, EyeOff, Wand2 } from 'lucide-react'
import { Alert, Button, Field, IconButton, Modal } from './ui'
import { SECRET_TYPES } from '../types'
import type { RevealResult, SecretInput, SecretMeta, SecretType } from '../types'
import { createSecretFn, updateSecretFn } from '../fn/secrets'
import { errorMessage } from '../lib/errors'

/** Generate a strong random value using the Web Crypto API (client-side). */
function generatePassword(length = 24): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length]
  return out
}

export function SecretForm({
  mode,
  meta,
  reveal,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  meta?: SecretMeta
  reveal?: RevealResult
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [name, setName] = useState(meta?.name ?? '')
  const [type, setType] = useState<SecretType>(meta?.type ?? 'password')
  const [username, setUsername] = useState(meta?.username ?? '')
  const [url, setUrl] = useState(meta?.url ?? '')
  const [value, setValue] = useState(reveal?.value ?? '')
  const [notes, setNotes] = useState(reveal?.notes ?? '')
  const [tags, setTags] = useState((meta?.tags ?? []).join(', '))
  const [showValue, setShowValue] = useState(mode === 'create')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Name is required.')
    if (!value) return setError('Secret value is required.')

    const input: SecretInput = {
      name: name.trim(),
      type,
      value,
      username: username.trim() || undefined,
      url: url.trim() || undefined,
      notes: notes || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30),
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        await createSecretFn({ data: input })
      } else {
        await updateSecretFn({ data: { ...input, id: meta!.id } })
      }
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Could not save the secret.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? 'New secret' : 'Edit secret'}
      description="Values and notes are encrypted with AES-256-GCM before they are stored."
      onClose={onClose}
      wide
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="secret-form" variant="primary" loading={saving}>
            {mode === 'create' ? 'Create secret' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="secret-form" onSubmit={submit} className="grid gap-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="f-name">
            <input
              id="f-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production database password"
              autoFocus
              maxLength={200}
            />
          </Field>
          <Field label="Type" htmlFor="f-type">
            <select
              id="f-type"
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as SecretType)}
            >
              {SECRET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username / account" htmlFor="f-user" hint="Optional — stored as metadata">
            <input
              id="f-user"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin@example.com"
              maxLength={200}
            />
          </Field>
          <Field label="URL" htmlFor="f-url" hint="Optional">
            <input
              id="f-url"
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              maxLength={2000}
            />
          </Field>
        </div>

        <Field label="Secret value">
          <div className="flex gap-2">
            <input
              className="input mono"
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="off"
              spellCheck={false}
              maxLength={20000}
            />
            <IconButton
              label={showValue ? 'Hide value' : 'Show value'}
              type="button"
              onClick={() => setShowValue((s) => !s)}
            >
              {showValue ? <EyeOff size={18} /> : <Eye size={18} />}
            </IconButton>
            <IconButton
              label="Generate strong value"
              type="button"
              onClick={() => {
                setValue(generatePassword())
                setShowValue(true)
              }}
            >
              <Wand2 size={18} />
            </IconButton>
          </div>
        </Field>

        <Field label="Notes" htmlFor="f-notes" hint="Optional — also encrypted">
          <textarea
            id="f-notes"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Recovery codes, rotation policy, where this is used…"
            rows={3}
            maxLength={20000}
          />
        </Field>

        <Field label="Tags" htmlFor="f-tags" hint="Comma-separated, e.g. prod, database">
          <input
            id="f-tags"
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="prod, database"
          />
        </Field>
      </form>
    </Modal>
  )
}
