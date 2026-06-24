/**
 * Thin JSON document helpers over the storage driver. Every record in this app
 * is a JSON object stored at a deterministic key (e.g. `secrets/<id>.json`).
 */
import { getStorage } from './storage'
import type { StoredObject } from './storage'

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await (await getStorage()).get(key)
  if (raw == null) return null
  return JSON.parse(raw) as T
}

export async function putJson(key: string, value: unknown): Promise<void> {
  await (await getStorage()).put(key, JSON.stringify(value, null, 2), 'application/json')
}

export async function delKey(key: string): Promise<void> {
  await (await getStorage()).delete(key)
}

export async function listKeys(prefix: string): Promise<StoredObject[]> {
  return (await getStorage()).list(prefix)
}

export async function hasKey(key: string): Promise<boolean> {
  return (await getStorage()).has(key)
}
