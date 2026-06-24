import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    // Preload a route + its data on hover/focus, so the click is instant.
    defaultPreload: 'intent',
    // Reuse hover-preloaded data on click within this window. (Was 0, which
    // meant preloaded data was always discarded and refetched on click.)
    defaultPreloadStaleTime: 30_000,
    // Re-visiting a tab within this window shows cached data instantly and
    // revalidates in the background. Mutations call router.invalidate() to refresh.
    defaultStaleTime: 10_000,
    // If a load runs past this, render the destination route with a spinner
    // immediately instead of blocking on the previous page.
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
    defaultPendingComponent: RoutePending,
  })

  return router
}

function RoutePending() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 1rem',
        color: '#6366f1',
      }}
    >
      <span className="spinner" style={{ width: '1.5rem', height: '1.5rem' }} aria-label="Loading" />
    </div>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
