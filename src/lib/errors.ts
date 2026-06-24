/** Extract a human-readable message from a thrown server-function error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err == null) return fallback
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return fallback
}
