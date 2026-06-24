/**
 * Minimal ambient types for the Cloudflare Workers runtime module used by the
 * R2-binding storage driver. Kept deliberately small so we don't pull all of
 * `@cloudflare/workers-types` into the global scope (which would clash with the
 * DOM/Node lib types this project already uses). `wrangler types` can generate a
 * fuller `worker-configuration.d.ts` if richer typing is wanted.
 */
interface R2ObjectLite {
  uploaded?: Date
}
interface R2ObjectBodyLite {
  text(): Promise<string>
}
interface R2ListedObjectLite {
  key: string
  size: number
  uploaded?: Date
}
interface R2ObjectsLite {
  objects: R2ListedObjectLite[]
  truncated: boolean
  cursor?: string
}
interface R2BucketLite {
  get(key: string): Promise<R2ObjectBodyLite | null>
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<R2ObjectLite>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; cursor?: string }): Promise<R2ObjectsLite>
  head(key: string): Promise<R2ObjectLite | null>
}

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    SECRETS_BUCKET: R2BucketLite
  }
}
