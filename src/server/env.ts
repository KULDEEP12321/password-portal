/**
 * Server-only environment configuration.
 *
 * Centralizes all secrets/config so they are read from `process.env` in exactly
 * one place, validated once, and never bundled into the client. The values here
 * (encryption key, R2 credentials, session password) must never be imported by
 * client code.
 */
import { Buffer } from 'node:buffer'

export type StorageDriverKind = 'r2' | 'local' | 'r2binding'

export interface R2Config {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export interface AdminSeed {
  username: string
  password: string
  name: string
}

export interface AppConfig {
  appName: string
  masterKey: Buffer
  sessionPassword: string
  sessionName: string
  sessionMaxAgeSec: number
  cookieSecure: boolean
  trustProxy: boolean
  storage: StorageDriverKind
  r2: R2Config | null
  localDir: string
  admin: AdminSeed | null
}

function req(name: string): string {
  const v = process.env[name]
  if (v == null || v.trim() === '') {
    throw new Error(`[env] Missing required environment variable: ${name}`)
  }
  return v.trim()
}

function opt(name: string): string | undefined {
  const v = process.env[name]
  return v == null || v.trim() === '' ? undefined : v.trim()
}

function parseMasterKey(): Buffer {
  const raw = req('MASTER_ENCRYPTION_KEY')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `[env] MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256 ` +
        `(got ${key.length}). Generate one with:  openssl rand -base64 32`,
    )
  }
  return key
}

function resolveR2(): R2Config | null {
  const accountId = opt('R2_ACCOUNT_ID')
  const explicitEndpoint = opt('R2_ENDPOINT')
  const accessKeyId = opt('R2_ACCESS_KEY_ID')
  const secretAccessKey = opt('R2_SECRET_ACCESS_KEY')
  const bucket = opt('R2_BUCKET')

  // R2 is only usable when we have credentials + a bucket + a way to reach it.
  if (!accessKeyId || !secretAccessKey || !bucket || (!accountId && !explicitEndpoint)) {
    return null
  }

  const endpoint = explicitEndpoint ?? `https://${accountId}.r2.cloudflarestorage.com`
  return {
    endpoint,
    region: opt('R2_REGION') ?? 'auto',
    accessKeyId,
    secretAccessKey,
    bucket,
  }
}

function buildConfig(): AppConfig {
  const masterKey = parseMasterKey()

  const sessionPassword = req('SESSION_PASSWORD')
  if (sessionPassword.length < 32) {
    throw new Error('[env] SESSION_PASSWORD must be at least 32 characters long.')
  }

  const r2 = resolveR2()
  const forcedDriver = opt('STORAGE_DRIVER') as StorageDriverKind | undefined
  const storage: StorageDriverKind = forcedDriver ?? (r2 ? 'r2' : 'local')

  if (storage === 'r2' && !r2) {
    throw new Error(
      '[env] STORAGE_DRIVER=r2 but R2 is not fully configured ' +
        '(need R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ACCOUNT_ID or R2_ENDPOINT).',
    )
  }

  const adminUser = opt('ADMIN_USERNAME')
  const adminPass = opt('ADMIN_PASSWORD')
  const admin: AdminSeed | null =
    adminUser && adminPass
      ? { username: adminUser, password: adminPass, name: opt('ADMIN_NAME') ?? 'Administrator' }
      : null

  // Secure-by-default: the session cookie is a bearer credential. Only an
  // explicit COOKIE_SECURE=false (for local http dev) disables the Secure flag.
  const cookieSecure = opt('COOKIE_SECURE') !== 'false'

  // Only trust X-Forwarded-For when explicitly enabled (i.e. behind a proxy you
  // control that sets it). Otherwise the socket IP — which a client cannot spoof
  // — is used for rate limiting and audit.
  const trustProxy = opt('TRUST_PROXY') === 'true'

  return {
    appName: opt('APP_NAME') ?? 'Vault',
    masterKey,
    sessionPassword,
    sessionName: opt('SESSION_COOKIE_NAME') ?? 'pp_session',
    sessionMaxAgeSec: Number(opt('SESSION_MAX_AGE_SEC') ?? 60 * 60 * 8), // 8h
    cookieSecure,
    trustProxy,
    storage,
    r2,
    localDir: opt('LOCAL_STORAGE_DIR') ?? '.data',
    admin,
  }
}

let cached: AppConfig | null = null

/** Lazily build + cache the validated app config. Throws on misconfiguration. */
export function getEnv(): AppConfig {
  if (cached == null) cached = buildConfig()
  return cached
}

/** For tests / hot reload: force the config to be rebuilt on next access. */
export function resetEnvCache(): void {
  cached = null
}
