/**
 * User accounts. Stored at `users/<username>.json`. Passwords are hashed with
 * bcrypt (cost 12) — the plaintext is never stored. The username is the primary
 * lookup key; the immutable `id` is used for session binding and audit.
 */
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { delKey, getJson, listKeys, putJson } from './db'
import { getEnv } from './env'
import { writeAudit } from './audit'
import { countProjects, createProject } from './projects'
import type { PublicUser, Role } from '../types'

// bcryptjs can't reliably auto-detect a CSPRNG in the Workers runtime, so wire it
// to WebCrypto's getRandomValues (available in Workers and Node). Registering the
// callback does no crypto work itself, so this is safe at module scope.
bcrypt.setRandomFallback((len: number) => {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
})

const BCRYPT_ROUNDS = 12
const PREFIX = 'users/'

export interface UserRecord {
  id: string
  username: string
  name: string
  role: Role
  passwordHash: string
  createdAt: string
  lastLoginAt?: string
}

/** Normalize a username for use as a storage key (case-insensitive, safe chars). */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function keyFor(username: string): string {
  return `${PREFIX}${normalizeUsername(username)}.json`
}

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  return getJson<UserRecord>(keyFor(username))
}

export async function listUserRecords(): Promise<UserRecord[]> {
  const keys = await listKeys(PREFIX)
  const loaded = await Promise.all(keys.map((k) => getJson<UserRecord>(k.key)))
  return loaded.filter((u): u is UserRecord => u != null)
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const all = await listUserRecords()
  return all.find((u) => u.id === id) ?? null
}

// A throwaway hash used to equalize response timing when the supplied username
// does not exist (mitigates enumeration). Computed lazily on first use so no
// hashing runs during module evaluation (Workers disallows CSPRNG at global scope).
let dummyHash: string | null = null
function getDummyHash(): string {
  if (dummyHash == null) {
    dummyHash = bcrypt.hashSync('password-portal-dummy-comparison-value', BCRYPT_ROUNDS)
  }
  return dummyHash
}

export async function verifyCredentials(
  user: UserRecord | null,
  password: string,
): Promise<boolean> {
  // Guard against a loaded record that isn't a real user (e.g. type confusion):
  // treat a missing/invalid hash like a non-existent user and still do a
  // constant-work comparison so timing doesn't reveal which case occurred.
  if (!user || typeof user.passwordHash !== 'string' || user.passwordHash.length === 0) {
    await bcrypt.compare(password, getDummyHash())
    return false
  }
  return bcrypt.compare(password, user.passwordHash)
}

export interface CreateUserInput {
  username: string
  name: string
  password: string
  role: Role
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const username = input.username.trim()
  const existing = await getUserByUsername(username)
  if (existing) {
    throw new Error(`A user named "${username}" already exists.`)
  }
  const record: UserRecord = {
    id: randomUUID(),
    username,
    name: input.name.trim(),
    role: input.role,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    createdAt: new Date().toISOString(),
  }
  await putJson(keyFor(username), record)
  return record
}

export async function deleteUserById(id: string): Promise<UserRecord | null> {
  const user = await getUserById(id)
  if (!user) return null
  await delKey(keyFor(user.username))
  return user
}

export async function markLogin(user: UserRecord): Promise<void> {
  user.lastLoginAt = new Date().toISOString()
  await putJson(keyFor(user.username), user)
}

/** Re-hash and persist a new password for an existing user. */
export async function setUserPassword(user: UserRecord, newPassword: string): Promise<void> {
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await putJson(keyFor(user.username), user)
}

export async function countUsers(): Promise<number> {
  const keys = await listKeys(PREFIX)
  return keys.length
}

/**
 * On first run, when no users exist and ADMIN_USERNAME/ADMIN_PASSWORD are set,
 * create the initial admin. Idempotent and safe to call on every request.
 */
let bootstrapPromise: Promise<void> | null = null
export function ensureBootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const admin = getEnv().admin
      if (!admin) return
      if ((await countUsers()) > 0) return
      const user = await createUser({
        username: admin.username,
        name: admin.name,
        password: admin.password,
        role: 'admin',
      })
      await writeAudit({
        actor: 'system',
        action: 'bootstrap',
        targetId: user.id,
        targetName: user.username,
        detail: 'Initial admin account created from environment.',
      })
      // eslint-disable-next-line no-console
      console.info(`[bootstrap] Created initial admin user "${user.username}".`)

      // Seed a default project so there is always somewhere to store secrets.
      if ((await countProjects()) === 0) {
        const project = await createProject(
          { name: 'General', description: 'Default project.', memberIds: [user.id] },
          user.username,
        )
        await writeAudit({
          actor: 'system',
          action: 'project.create',
          targetId: project.id,
          targetName: project.name,
          detail: 'Default project created.',
        })
      }
    })().catch((err) => {
      // Reset so a transient failure can be retried on the next request.
      bootstrapPromise = null
      throw err
    })
  }
  return bootstrapPromise
}
