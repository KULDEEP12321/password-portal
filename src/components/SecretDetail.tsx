import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Eye, EyeOff, Pencil } from 'lucide-react'
import { Alert, Button, IconButton, Modal, TypeBadge } from './ui'
import type { RevealResult, SecretMeta } from '../types'
import { revealSecretFn } from '../fn/secrets'
import { copyText } from '../lib/clipboard'
import { errorMessage } from '../lib/errors'
import { formatRelative } from '../lib/format'

/** Read-only detail view: shows every field of a secret, including the URL and the
 *  decrypted notes (which the table row never surfaces). The value and notes are
 *  decrypted once on open via the audited reveal endpoint. */
export function SecretDetail({
  secret,
  canWrite,
  onClose,
  onEdit,
}: {
  secret: SecretMeta
  canWrite: boolean
  onClose: () => void
  onEdit: (secret: SecretMeta) => void
}) {
  const [reveal, setReveal] = useState<RevealResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showValue, setShowValue] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    revealSecretFn({ data: { id: secret.id } })
      .then((r) => active && setReveal(r))
      .catch((err) => active && setError(errorMessage(err, 'Could not decrypt this secret.')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [secret.id])

  const isHttp = !!secret.url && /^https?:\/\//i.test(secret.url)

  return (
    <Modal
      title={secret.name}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canWrite && (
            <Button variant="primary" onClick={() => onEdit(secret)}>
              <Pencil size={16} />
              Edit
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={secret.type} />
          <span className="text-xs" style={{ color: 'var(--text-faint)' }} suppressHydrationWarning>
            Updated {formatRelative(secret.updatedAt)} · by {secret.updatedBy}
          </span>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {secret.username && (
          <Field label="Username">
            <ValueLine>
              <code className="mono text-sm" style={{ color: 'var(--text)', wordBreak: 'break-all' }}>
                {secret.username}
              </code>
              <CopyBtn value={secret.username} label="username" />
            </ValueLine>
          </Field>
        )}

        {secret.url && (
          <Field label="URL">
            <ValueLine>
              {isHttp ? (
                <a
                  href={secret.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-sm inline-flex items-center gap-1.5"
                  style={{ color: 'var(--accent-soft)', wordBreak: 'break-all' }}
                >
                  {secret.url}
                  <ExternalLink size={13} style={{ flexShrink: 0 }} />
                </a>
              ) : (
                <code className="mono text-sm" style={{ color: 'var(--text)', wordBreak: 'break-all' }}>
                  {secret.url}
                </code>
              )}
              <CopyBtn value={secret.url} label="URL" />
            </ValueLine>
          </Field>
        )}

        <Field label="Value">
          {loading ? (
            <Muted>Decrypting…</Muted>
          ) : reveal ? (
            <ValueLine>
              <code
                className="mono text-sm"
                style={{ color: showValue ? 'var(--text)' : 'var(--text-faint)', wordBreak: 'break-all' }}
              >
                {showValue ? reveal.value || '—' : '••••••••••••'}
              </code>
              <IconButton label={showValue ? 'Hide' : 'Reveal'} onClick={() => setShowValue((s) => !s)}>
                {showValue ? <EyeOff size={15} /> : <Eye size={15} />}
              </IconButton>
              <CopyBtn value={reveal.value} label="value" />
            </ValueLine>
          ) : null}
        </Field>

        {(secret.hasNotes || (reveal && reveal.notes)) && (
          <Field label="Notes">
            {loading ? (
              <Muted>Decrypting…</Muted>
            ) : reveal?.notes ? (
              <div className="flex items-start gap-2">
                <pre
                  className="mono text-sm"
                  style={{
                    flex: 1,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'var(--text-soft)',
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                    maxHeight: 320,
                    overflow: 'auto',
                  }}
                >
                  {reveal.notes}
                </pre>
                <CopyBtn value={reveal.notes} label="notes" />
              </div>
            ) : (
              <Muted>—</Muted>
            )}
          </Field>
        )}

        {secret.tags.length > 0 && (
          <Field label="Tags">
            <div className="flex flex-wrap gap-1">
              {secret.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ValueLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
      {children}
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm" style={{ color: 'var(--text-faint)' }}>
      {children}
    </span>
  )
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <IconButton
      label={`Copy ${label}`}
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? <Check size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
    </IconButton>
  )
}
