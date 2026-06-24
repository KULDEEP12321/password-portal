/**
 * Typed application error. Server functions throw these; the message is safe to
 * surface to authenticated users. `status`/`code` let the client react (e.g. a
 * 401 can route to /login).
 */
export class AppError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}

export const Errors = {
  unauthorized: (msg = 'You are not signed in.') => new AppError(msg, 401, 'UNAUTHORIZED'),
  forbidden: (msg = 'You do not have permission to do that.') =>
    new AppError(msg, 403, 'FORBIDDEN'),
  notFound: (msg = 'Not found.') => new AppError(msg, 404, 'NOT_FOUND'),
  rateLimited: (msg = 'Too many requests. Please slow down.') =>
    new AppError(msg, 429, 'RATE_LIMITED'),
  conflict: (msg: string) => new AppError(msg, 409, 'CONFLICT'),
  badRequest: (msg: string) => new AppError(msg, 400, 'BAD_REQUEST'),
}
