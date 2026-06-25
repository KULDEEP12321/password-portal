/**
 * Shared, client-safe types.
 *
 * IMPORTANT: This module must never import server-only code (node built-ins,
 * the AWS SDK, bcrypt, etc.). It is imported by both the browser bundle and the
 * server, so keep it to pure type declarations and small constant tables.
 */

export type Role = 'admin' | 'editor' | 'viewer'

export const ROLES: readonly Role[] = ['admin', 'editor', 'viewer'] as const

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

/** What a role is allowed to do. Enforced server-side; mirrored here for the UI. */
export const ROLE_CAN = {
  /** Create / edit / delete secrets. */
  write: (role: Role) => role === 'admin' || role === 'editor',
  /** Reveal (decrypt) and read secrets. Everyone with access can read. */
  read: () => true,
  /** Manage users and view the global audit log. */
  administer: (role: Role) => role === 'admin',
} as const

export type SecretType =
  | 'password'
  | 'api_key'
  | 'access_token'
  | 'credential'
  | 'ssh_key'
  | 'database_url'
  | 'certificate'
  | 'note'
  | 'other'

export const SECRET_TYPES: { value: SecretType; label: string }[] = [
  { value: 'password', label: 'Password' },
  { value: 'api_key', label: 'API Key' },
  { value: 'access_token', label: 'Access Token' },
  { value: 'credential', label: 'Credential' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'database_url', label: 'Database URL' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'note', label: 'Secure Note' },
  { value: 'other', label: 'Other' },
]

/** A registered user, without any sensitive fields (never includes the hash). */
export interface PublicUser {
  id: string
  username: string
  name: string
  role: Role
  createdAt: string
  lastLoginAt?: string
}

/**
 * Secret metadata returned to the client for listing/search.
 * This NEVER contains the decrypted value or notes — only the searchable
 * metadata. The sensitive value is fetched separately via `revealSecret`.
 */
export interface SecretMeta {
  id: string
  name: string
  type: SecretType
  username?: string
  url?: string
  tags: string[]
  hasNotes: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/** The decrypted payload returned only by `revealSecret`. */
export interface RevealResult {
  value: string
  notes?: string
}

/** Shape submitted by the create/edit form. */
export interface SecretInput {
  name: string
  type: SecretType
  value: string
  username?: string
  url?: string
  notes?: string
  tags: string[]
}

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'secret.create'
  | 'secret.update'
  | 'secret.delete'
  | 'secret.reveal'
  | 'user.create'
  | 'user.delete'
  | 'user.password'
  | 'audit.clear'
  | 'bootstrap'

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  logout: 'Signed out',
  'secret.create': 'Created secret',
  'secret.update': 'Updated secret',
  'secret.delete': 'Deleted secret',
  'secret.reveal': 'Revealed secret',
  'user.create': 'Created user',
  'user.delete': 'Deleted user',
  'user.password': 'Changed password',
  'audit.clear': 'Cleared audit log',
  bootstrap: 'Bootstrapped admin',
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  actorId?: string
  action: AuditAction
  targetId?: string
  targetName?: string
  ip?: string
  userAgent?: string
  success: boolean
  detail?: string
}
