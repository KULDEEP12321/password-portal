import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { Role, SecretType } from '../types'
import { ROLE_LABELS, SECRET_TYPES } from '../types'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'danger' && 'btn-danger',
        variant === 'ghost' && 'btn-ghost',
        size === 'sm' && 'btn-sm',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  )
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
}
export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button className={cn('icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Form field                                                                 */
/* -------------------------------------------------------------------------- */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={cn('surface fade-in w-full', wide ? 'max-w-2xl' : 'max-w-lg')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-4 border-b hairline p-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-soft)' }}>
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="p-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t hairline p-5">{footer}</footer>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */
export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn('badge', role === 'admin' && 'badge-accent')}>{ROLE_LABELS[role]}</span>
  )
}

const TYPE_LABEL = new Map(SECRET_TYPES.map((t) => [t.value, t.label]))
export function TypeBadge({ type }: { type: SecretType }) {
  return <span className="badge">{TYPE_LABEL.get(type) ?? type}</span>
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                      */
/* -------------------------------------------------------------------------- */
export function Alert({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'success' | 'danger'
  children: ReactNode
}) {
  const color =
    variant === 'danger'
      ? 'var(--danger)'
      : variant === 'success'
        ? 'var(--success)'
        : 'var(--accent-soft)'
  const bg =
    variant === 'danger'
      ? 'var(--danger-bg)'
      : variant === 'success'
        ? 'var(--success-bg)'
        : 'var(--accent-bg)'
  const Icon = variant === 'danger' ? AlertTriangle : variant === 'success' ? CheckCircle2 : Info
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm"
      style={{ background: bg, border: `1px solid ${color}33`, color: 'var(--text)' }}
      role={variant === 'danger' ? 'alert' : 'status'}
    >
      <Icon size={16} style={{ color, marginTop: 1, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'var(--panel-2)', color: 'var(--text-faint)' }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--text-soft)' }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
