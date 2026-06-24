/**
 * Cloudflare R2 storage driver using the native Workers binding.
 *
 * On Workers the bucket is reached through the `SECRETS_BUCKET` binding declared
 * in wrangler.jsonc — no S3 access keys are needed, and the credentials never
 * exist in app config. This module imports `cloudflare:workers`, so it is loaded
 * only when STORAGE_DRIVER=r2binding (see ./index.ts dynamic import).
 */
import { env } from 'cloudflare:workers'
import type { StorageDriver, StoredObject } from './types'

export class R2BindingStorage implements StorageDriver {
  readonly kind = 'r2binding' as const

  async get(key: string): Promise<string | null> {
    const obj = await env.SECRETS_BUCKET.get(key)
    return obj ? await obj.text() : null
  }

  async put(key: string, body: string, contentType = 'application/json'): Promise<void> {
    await env.SECRETS_BUCKET.put(key, body, { httpMetadata: { contentType } })
  }

  async delete(key: string): Promise<void> {
    await env.SECRETS_BUCKET.delete(key)
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const out: StoredObject[] = []
    let cursor: string | undefined
    do {
      const res = await env.SECRETS_BUCKET.list({ prefix, cursor })
      for (const o of res.objects) {
        out.push({ key: o.key, size: o.size, lastModified: o.uploaded?.toISOString() })
      }
      cursor = res.truncated ? res.cursor : undefined
    } while (cursor)
    return out
  }

  async has(key: string): Promise<boolean> {
    return (await env.SECRETS_BUCKET.head(key)) !== null
  }
}
