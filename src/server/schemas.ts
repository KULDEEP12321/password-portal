/**
 * Input validation schemas (Zod). Used by server functions to validate and
 * sanitize (trim + length-cap + charset) every payload before it reaches domain
 * logic. Identifiers are constrained to a safe charset so they can never be used
 * to escape their storage-key prefix (path traversal).
 */
import { z } from 'zod'

/** Record ids are produced by crypto.randomUUID(); pin them to the UUID shape. */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const idValue = z.string().regex(UUID_RE, 'Invalid id')

export const loginSchema = z.object({
  // No slashes/backslashes (defends storage-key construction); generous otherwise.
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(100)
    .regex(/^[A-Za-z0-9._@+-]+$/, 'Invalid username'),
  password: z.string().min(1, 'Password is required').max(200),
})
export type LoginInput = z.infer<typeof loginSchema>

const secretTypeSchema = z.enum([
  'password',
  'api_key',
  'access_token',
  'credential',
  'ssh_key',
  'database_url',
  'certificate',
  'note',
  'other',
])

export const secretInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: secretTypeSchema,
  value: z.string().min(1, 'Value is required').max(20000),
  username: z.string().trim().max(200).optional().default(''),
  // Only http(s) links are allowed (the value is rendered as an anchor href).
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Only http(s) URLs are allowed')
    .optional()
    .default(''),
  notes: z.string().max(20000).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
})

export const updateSecretSchema = secretInputSchema.extend({ id: idValue })

export const idSchema = z.object({ id: idValue })

export const roleSchema = z.enum(['admin', 'editor', 'viewer'])

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
})

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9._-]{3,40}$/,
      'Use 3–40 characters: letters, numbers, dots, dashes, underscores',
    ),
  name: z.string().trim().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  role: roleSchema,
})
