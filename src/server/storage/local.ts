/**
 * Local filesystem storage driver — DEVELOPMENT FALLBACK ONLY.
 *
 * Used automatically when R2 credentials are not configured, so the app runs
 * out of the box. Objects are written under a base directory (default `.data`,
 * which is git-ignored). Do not use this in production.
 */
import { mkdir, readFile, writeFile, rm, readdir, stat } from 'node:fs/promises'
import { join, dirname, resolve, sep } from 'node:path'
import type { StorageDriver, StoredObject } from './types'

export class LocalStorage implements StorageDriver {
  readonly kind = 'local' as const
  private readonly base: string

  constructor(baseDir: string) {
    this.base = resolve(process.cwd(), baseDir)
  }

  /** Map an object key to an absolute path, guarding against path traversal. */
  private pathFor(key: string): string {
    // Reject traversal *within* the bucket: a key must not contain a `..` or
    // empty segment, a backslash, or a leading slash — so it can never cross
    // into a sibling prefix (e.g. `secrets/../users/admin`).
    const segments = key.split('/')
    if (key.includes('\\') || segments.some((s) => s === '..' || s === '')) {
      throw new Error(`Illegal storage key: ${key}`)
    }
    const target = resolve(this.base, key)
    if (target !== this.base && !target.startsWith(this.base + sep)) {
      throw new Error(`Illegal storage key (path traversal): ${key}`)
    }
    return target
  }

  async get(key: string): Promise<string | null> {
    try {
      return await readFile(this.pathFor(key), 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async put(key: string, body: string): Promise<void> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body, 'utf-8')
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const out: StoredObject[] = []
    const walk = async (dir: string): Promise<void> => {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
        throw err
      }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else {
          const key = full.slice(this.base.length + 1).split(sep).join('/')
          if (key.startsWith(prefix)) {
            const s = await stat(full)
            out.push({ key, size: s.size, lastModified: s.mtime.toISOString() })
          }
        }
      }
    }
    await walk(this.base)
    return out
  }

  async has(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key))
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw err
    }
  }
}
