import { getEnv } from '../env'
import type { StorageDriver } from './types'

export type { StorageDriver, StoredObject } from './types'

let instancePromise: Promise<StorageDriver> | null = null

/**
 * Build the configured driver. Drivers are imported dynamically so that only the
 * selected one is loaded — this keeps the `cloudflare:workers` module (R2 binding)
 * and `node:fs` (local) out of bundles/runtimes where they don't belong.
 */
async function build(): Promise<StorageDriver> {
  const env = getEnv()

  if (env.storage === 'r2binding') {
    const { R2BindingStorage } = await import('./r2binding')
    return new R2BindingStorage()
  }

  if (env.storage === 'r2' && env.r2) {
    const { R2Storage } = await import('./r2')
    return new R2Storage(env.r2)
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[storage] Using LOCAL filesystem storage (./${env.localDir}). ` +
      'Development fallback only — configure R2 for production.',
  )
  const { LocalStorage } = await import('./local')
  return new LocalStorage(env.localDir)
}

/** Returns the configured storage driver as a singleton (async, cached). */
export function getStorage(): Promise<StorageDriver> {
  if (!instancePromise) instancePromise = build()
  return instancePromise
}
