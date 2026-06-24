import { useState } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { KeyRound, Lock, ShieldCheck, User } from 'lucide-react'
import { loginFn, meFn } from '../fn/auth'
import { Alert, Button, Field } from '../components/ui'
import { errorMessage } from '../lib/errors'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await meFn()
    if (user) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
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

        <form onSubmit={submit} className="surface grid gap-4 p-6">
          {error && <Alert variant="danger">{error}</Alert>}

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
                autoFocus
                required
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
                required
              />
            </div>
          </Field>

          <Button type="submit" variant="primary" loading={loading} className="mt-1 w-full">
            <KeyRound size={16} />
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          First run? The initial admin is created from <code>ADMIN_USERNAME</code> /{' '}
          <code>ADMIN_PASSWORD</code>.
        </p>
      </div>
    </main>
  )
}
