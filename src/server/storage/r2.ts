/**
 * Cloudflare R2 storage driver.
 *
 * R2 is S3-API compatible, so we use the AWS SDK v3 S3 client pointed at the R2
 * endpoint with region "auto". Credentials come exclusively from server-side env
 * config and are never exposed to the client.
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import type { R2Config } from '../env'
import type { StorageDriver, StoredObject } from './types'

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    e?.name === 'NoSuchKey' ||
    e?.name === 'NotFound' ||
    e?.$metadata?.httpStatusCode === 404
  )
}

export class R2Storage implements StorageDriver {
  readonly kind = 'r2' as const
  private readonly client: S3Client
  private readonly bucket: string

  constructor(cfg: R2Config) {
    this.bucket = cfg.bucket
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    })
  }

  async get(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      // A missing key throws NoSuchKey (handled below); a 200 with no body is an
      // abnormal backend response — surface it rather than masking it as "not found".
      if (!res.Body) throw new Error(`R2 returned an empty body for existing key: ${key}`)
      return await res.Body.transformToString('utf-8')
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  }

  async put(key: string, body: string, contentType = 'application/json'): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const out: StoredObject[] = []
    let token: string | undefined
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      )
      for (const obj of res.Contents ?? []) {
        if (!obj.Key) continue
        out.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString(),
        })
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)
    return out
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch (err) {
      if (isNotFound(err)) return false
      throw err
    }
  }
}
