import { useState } from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { KeyRound, LogOut, ScrollText, ShieldCheck, Users } from 'lucide-react'
import { logoutFn, meFn } from '../../fn/auth'
import { Button, RoleBadge, cn } from '../../components/ui'
import { ChangePasswordModal } from '../../components/ChangePasswordModal'
import { ROLE_CAN } from '../../types'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const user = await meFn()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const isAdmin = ROLE_CAN.administer(user.role)

  async function logout() {
    setLoggingOut(true)
    try {
      await logoutFn()
      await router.invalidate()
      await navigate({ to: '/login' })
    } finally {
      setLoggingOut(false)
    }
  }

  const navLinkClass = 'btn btn-ghost btn-sm'
  const activeProps = { className: cn(navLinkClass, 'is-active'), style: { color: 'var(--text)', background: 'var(--panel-2)' } }

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-30 border-b hairline"
        style={{ background: 'rgba(10,13,20,0.82)', backdropFilter: 'blur(10px)' }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent-soft)' }}
              >
                <ShieldCheck size={17} />
              </span>
              <span className="font-bold tracking-tight">Vault</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link to="/dashboard" activeOptions={{ exact: true }} className={navLinkClass} activeProps={activeProps}>
                <KeyRound size={15} />
                Secrets
              </Link>
              {isAdmin && (
                <Link to="/dashboard/audit" className={navLinkClass} activeProps={activeProps}>
                  <ScrollText size={15} />
                  Audit
                </Link>
              )}
              {isAdmin && (
                <Link to="/dashboard/users" className={navLinkClass} activeProps={activeProps}>
                  <Users size={15} />
                  Users
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm" style={{ color: 'var(--text-soft)' }}>
                {user.name}
              </span>
              <RoleBadge role={user.role} />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowChangePw(true)}
              title="Change password"
            >
              <KeyRound size={15} />
              <span className="hidden sm:inline">Password</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={logout} loading={loggingOut} title="Sign out">
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7">
        <Outlet />
      </main>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}
