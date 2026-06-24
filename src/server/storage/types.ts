import type { StorageDriverKind } from '../env'

export interface StoredObject {
  key: string
  size: number
  lastModified?: string
}

/**
 * Minimal object-storage abstraction. Implemented by the R2 (production) and
 * local-filesystem (development fallback) drivers. All values are JSON strings.
 */
export interface StorageDriver {
  readonly kind: StorageDriverKind
  /** Returns the object's UTF-8 contents, or null if it does not exist. */
  get(key: string): Promise<string | null>
  put(key: string, body: string, contentType?: string): Promise<void>
  delete(key: string): Promise<void>
  /** Lists every object whose key starts with `prefix`. */
  list(prefix: string): Promise<StoredObject[]>
  has(key: string): Promise<boolean>
}
