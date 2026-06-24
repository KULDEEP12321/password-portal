/**
 * Authenticated symmetric encryption for secret values.
 *
 * Uses AES-256-GCM:
 *   - 256-bit key, sourced from MASTER_ENCRYPTION_KEY (never leaves the server).
 *   - Fresh random 96-bit IV per encryption.
 *   - 128-bit GCM auth tag for tamper detection (decryption fails if the
 *     ciphertext, IV, or tag are modified).
 *
 * The encryption key is held only in server memory and is never serialized into
 * any stored record or sent to the client.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { getEnv } from './env'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const CURRENT_VERSION = 1

export interface EncryptedPayload {
  /** Scheme version, so the format can evolve / keys can be rotated later. */
  v: number
  /** Base64 initialization vector. */
  iv: string
  /** Base64 GCM authentication tag. */
  tag: string
  /** Base64 ciphertext. */
  data: string
}

export function encryptString(plaintext: string): EncryptedPayload {
  const key = getEnv().masterKey
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: CURRENT_VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  }
}

export function decryptString(payload: EncryptedPayload): string {
  if (!isEncryptedPayload(payload)) {
    throw new Error('Refusing to decrypt: value is not a valid encrypted payload.')
  }
  // Pin the scheme version: only decrypt formats this build understands. When a
  // v2 format is introduced, branch here to select the matching algorithm/key.
  if (payload.v !== CURRENT_VERSION) {
    throw new Error(`Unsupported encryption version: ${payload.v}`)
  }
  const key = getEnv().masterKey
  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const data = Buffer.from(payload.data, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  // .final() throws if the auth tag does not verify — i.e. on tampering or wrong key.
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (value == null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.v === 'number' &&
    typeof v.iv === 'string' &&
    typeof v.tag === 'string' &&
    typeof v.data === 'string'
  )
}
