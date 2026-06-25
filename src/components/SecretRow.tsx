import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Eye, EyeOff, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { IconButton, TypeBadge, cn } from './ui'
import type { SecretMeta } from '../types'
import { revealSecretFn } from '../fn/secrets'
import { copyText } from '../lib/clipboard'
import { errorMessage } from '../lib/errors'
import { formatRelative } from '../lib/format'

const MASK = '•••••••••••••'

export function SecretRow({
  secret,
  canWrite,
  onView,
  onEdit,
  onDelete,
}: {
  secret: SecretMeta
  canWrite: boolean
  onView: (secret: SecretMeta) => void
  onEdit: (secret: SecretMeta) => void
  onDelete: (secret: SecretMeta) => void
}) {
  const [value, setValue] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  /** Fetch + decrypt the value on demand (server-side), caching it for the row. */
  async function ensureValue(): Promise<string | null> {
    if (value != null) return value
    setLoading(true)
    setError(null)
    try {
      const result = await revealSecretFn({ data: { id: secret.id } })
      setValue(result.value)
      return result.value
    } catch (err) {
      setError(errorMessage(err, 'Could not reveal secret.'))
      return null
    } finally {
      setLoading(false)
    }
  }

  async function toggleReveal() {
    if (value == null) {
      const v = await ensureValue()
      if (v != null) setShown(true)
    } else {
      setShown((s) => !s)
    }
  }

  async function copy() {
    const v = await ensureValue()
    if (v == null) return
    const ok = await copyText(v)
    if (ok) {
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } else {
      setError('Clipboard unavailable.')
    }
  }

  return (
    <tr>
      <td>
        <button
          type="button"
          onClick={() => onView(secret)}
          title="View details (URL, notes, value)"
          className="font-medium"
          style={{
            color: 'var(--accent-soft)',
            background: 'none',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {secret.name}
        </button>
        <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--text-faint)' }}>
          {secret.username && <span>{secret.username}</span>}
          {secret.url && /^https?:\/\//i.test(secret.url) && (
            <a
              href={secret.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              <ExternalLink size={11} />
              link
            </a>
          )}
          {secret.hasNotes && (
            <span className="inline-flex items-center gap-1" title="Has notes">
              <StickyNote size={11} />
              notes
            </span>
          )}
        </div>
      </td>

      <td>
        <TypeBadge type={secret.type} />
      </td>

      <td>
        <div className="flex items-center gap-2">
          <code
            className={cn('mono text-sm', !shown && 'tracking-wider')}
            style={{ color: shown ? 'var(--text)' : 'var(--text-faint)' }}
          >
            {loading ? '…' : shown && value != null ? value : MASK}
          </code>
        </div>
        {error && (
          <div className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        )}
      </td>

      <td>
        <div className="flex max-w-[16rem] flex-wrap gap-1">
          {secret.tags.length === 0 ? (
            <span style={{ color: 'var(--text-faint)' }}>—</span>
          ) : (
            secret.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))
          )}
        </div>
      </td>

      <td>
        <span
          className="text-sm"
          style={{ color: 'var(--text-soft)' }}
          title={`Updated by ${secret.updatedBy}`}
          suppressHydrationWarning
        >
          {formatRelative(secret.updatedAt)}
        </span>
      </td>

      <td>
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label={shown ? 'Hide' : 'Reveal'} onClick={toggleReveal} disabled={loading}>
            {shown ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
          <IconButton label="Copy" onClick={copy} disabled={loading}>
            {copied ? <Check size={17} style={{ color: 'var(--success)' }} /> : <Copy size={17} />}
          </IconButton>
          {canWrite && (
            <>
              <IconButton label="Edit" onClick={() => onEdit(secret)}>
                <Pencil size={16} />
              </IconButton>
              <IconButton label="Delete" onClick={() => onDelete(secret)}>
                <Trash2 size={16} style={{ color: 'var(--danger)' }} />
              </IconButton>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
