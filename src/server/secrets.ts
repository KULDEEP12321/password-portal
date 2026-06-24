/**
 * Secret records. Stored at `secrets/<id>.json`.
 *
 * Only the sensitive fields — `value` and optional `notes` — are encrypted at
 * rest (AES-256-GCM). The remaining metadata (name, type, username, url, tags)
 * is stored in cleartext so the dashboard can list, search, and filter without
 * decrypting anything. The decrypted value is returned ONLY via `revealSecret`.
 */
import { randomUUID } from 'node:crypto'
import { delKey, getJson, listKeys, putJson } from './db'
import { decryptString, encryptString } from './crypto'
import type { EncryptedPayload } from './crypto'
import { Errors } from './errors'
import type { RevealResult, SecretInput, SecretMeta, SecretType } from '../types'

const PREFIX = 'secrets/'

interface SecretRecord {
  id: string
  name: string
  type: SecretType
  username?: string
  url?: string
  tags: string[]
  value: EncryptedPayload
  notes?: EncryptedPayload
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

function keyFor(id: string): string {
  return `${PREFIX}${id}.json`
}

function toMeta(rec: SecretRecord): SecretMeta {
  return {
    id: rec.id,
    name: rec.name,
    type: rec.type,
    username: rec.username,
    url: rec.url,
    tags: rec.tags,
    hasNotes: rec.notes != null,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    createdBy: rec.createdBy,
    updatedBy: rec.updatedBy,
  }
}

async function loadRecord(id: string): Promise<SecretRecord> {
  const rec = await getJson<SecretRecord>(keyFor(id))
  if (!rec) throw Errors.notFound('Secret not found.')
  return rec
}

export async function listSecrets(): Promise<SecretMeta[]> {
  const keys = await listKeys(PREFIX)
  const loaded = await Promise.all(keys.map((k) => getJson<SecretRecord>(k.key)))
  return loaded
    .filter((r): r is SecretRecord => r != null)
    .map(toMeta)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getSecretMeta(id: string): Promise<SecretMeta> {
  return toMeta(await loadRecord(id))
}

/** Decrypts and returns the sensitive payload. */
export async function revealSecret(id: string): Promise<RevealResult> {
  const rec = await loadRecord(id)
  // Read-only: access is recorded in the append-only audit log instead of
  // writing back here, which would risk clobbering a concurrent edit.
  return {
    value: decryptString(rec.value),
    notes: rec.notes ? decryptString(rec.notes) : undefined,
  }
}

export async function createSecret(input: SecretInput, actor: string): Promise<SecretMeta> {
  const now = new Date().toISOString()
  const rec: SecretRecord = {
    id: randomUUID(),
    name: input.name,
    type: input.type,
    username: input.username || undefined,
    url: input.url || undefined,
    tags: input.tags,
    value: encryptString(input.value),
    notes: input.notes ? encryptString(input.notes) : undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor,
  }
  await putJson(keyFor(rec.id), rec)
  return toMeta(rec)
}

export async function updateSecret(
  id: string,
  input: SecretInput,
  actor: string,
): Promise<SecretMeta> {
  const rec = await loadRecord(id)
  rec.name = input.name
  rec.type = input.type
  rec.username = input.username || undefined
  rec.url = input.url || undefined
  rec.tags = input.tags
  rec.value = encryptString(input.value)
  rec.notes = input.notes ? encryptString(input.notes) : undefined
  rec.updatedAt = new Date().toISOString()
  rec.updatedBy = actor
  await putJson(keyFor(id), rec)
  return toMeta(rec)
}

export async function deleteSecret(id: string): Promise<SecretMeta> {
  const rec = await loadRecord(id)
  await delKey(keyFor(id))
  return toMeta(rec)
}
