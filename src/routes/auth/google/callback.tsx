/**
 * Google's redirect target. Google sends the browser here with `?code&state`.
 * The component completes the exchange via the finishGoogleFn RPC (so the
 * session cookie is applied on a real fetch response), then routes onward.
 */
import { useEffect, useRef } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { finishGoogleFn } from '../../../fn/oauth'
import { errorMessage } from '../../../lib/errors'

const KNOWN_ERRORS = new Set([
  'oauth_state',
  'oauth_unverified',
  'unauthorized',
  'oauth_unconfigured',
])

export const Route = createFileRoute('/auth/google/callback')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { code?: string; state?: string; error?: string } => ({
    code: typeof s.code === 'string' ? s.code : undefined,
    state: typeof s.state === 'string' ? s.state : undefined,
    error: typeof s.error === 'string' ? s.error : undefined,
  }),
  component: GoogleCallback,
})

function GoogleCallback() {
  const { code, state, error } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // guard against the StrictMode double-effect
    ran.current = true
    void (async () => {
      if (error || !code || !state) {
        await navigate({ to: '/login', search: { error: 'oauth_failed' } })
        return
      }
      try {
        await finishGoogleFn({ data: { code, state } })
        await router.invalidate()
        await navigate({ to: '/dashboard' })
      } catch (err) {
        const msg = errorMessage(err, 'oauth_failed')
        await navigate({
          to: '/login',
          search: { error: KNOWN_ERRORS.has(msg) ? msg : 'oauth_failed' },
        })
      }
    })()
  }, [code, state, error, navigate, router])

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
        Signing you in…
      </p>
    </main>
  )
}
