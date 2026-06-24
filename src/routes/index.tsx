import { createFileRoute, redirect } from '@tanstack/react-router'
import { meFn } from '../fn/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await meFn()
    throw redirect({ to: user ? '/dashboard' : '/login' })
  },
})
