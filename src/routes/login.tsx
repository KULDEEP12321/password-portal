import { useState } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { KeyRound, Lock, ShieldCheck, User } from 'lucide-react'
import { loginFn, meFn } from '../fn/auth'
import { startGoogleFn } from '../fn/oauth'
import { Alert, Button, Field } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { errorMessage } from '../lib/errors'

const ERROR_TEXT: Record<string, string> = {
  unauthorized: 'This Google account isn’t on the allowlist. Ask an admin to add your email.',
  oauth_state: 'Your sign-in session expired. Please try again.',
  oauth_failed: 'Google sign-in didn’t complete. Please try again.',
  oauth_unverified: 'Your Google email address isn’t verified.',
  oauth_unconfigured: 'Google sign-in isn’t configured yet.',
}

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): { error?: string } =>
    typeof s.error === 'string' ? { error: s.error } : {},
  beforeLoad: async () => {
    const user = await meFn()
    if (user) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1-.34-2.1c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

function LoginPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const { error: searchError } = Route.useSearch()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const banner = error ?? (searchError ? (ERROR_TEXT[searchError] ?? 'Sign-in failed.') : null)

  async function google() {
    setError(null)
    setGoogleBusy(true)
    try {
      const { url } = await startGoogleFn()
      window.location.href = url
    } catch (err) {
      const msg = errorMessage(err, 'oauth_failed')
      setError(ERROR_TEXT[msg] ?? 'Could not start Google sign-in.')
      setGoogleBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await loginFn({ data: { username, password } })
      await router.invalidate()
      await navigate({ to: '/dashboard' })
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed.'))
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent-soft)' }}
          >
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Vault</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-soft)' }}>
            Internal secrets &amp; password portal
          </p>
        </div>

        <div className="surface grid gap-4 p-6">
          {banner && <Alert variant="danger">{banner}</Alert>}

          <button
            type="button"
            onClick={google}
            disabled={googleBusy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              background: '#ffffff',
              color: '#1f1f1f',
              border: '1px solid #dadce0',
              fontWeight: 600,
              fontSize: 14,
              cursor: googleBusy ? 'default' : 'pointer',
              opacity: googleBusy ? 0.7 : 1,
            }}
          >
            <GoogleG />
            {googleBusy ? 'Connecting…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3" style={{ color: 'var(--text-faint)' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
            <span className="text-xs">or password</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
          </div>

          <form onSubmit={submit} className="grid gap-4">
            <Field label="Username" htmlFor="username">
              <div className="relative">
                <User
                  size={16}
                  style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)' }}
                />
                <input
                  id="username"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)' }}
                />
                <input
                  id="password"
                  type="password"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </Field>

            <Button type="submit" variant="primary" loading={loading} className="mt-1 w-full">
              <KeyRound size={16} />
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          Access is granted by an admin. Sign in with the Google account you were added with.
        </p>
      </div>
    </main>
  )
}
