import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // Internal tool: keep it out of search indexes.
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Vault · Secrets Portal' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  // Safety net: any uncaught error renders a friendly screen instead of a crash.
  errorComponent: RootErrorComponent,
  shellComponent: RootDocument,
})

function RootErrorComponent({ error }: { error: Error }) {
  // Inline styles so this renders even if the stylesheet failed to load.
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: '#0a0d14',
        color: '#e6e9f0',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          border: '1px solid #252c3e',
          borderRadius: 16,
          background: '#141926',
          padding: '1.75rem',
        }}
      >
        <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#9aa3b8',
            margin: '0 0 1.25rem',
            wordBreak: 'break-word',
          }}
        >
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <a
          href="/login"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            padding: '0.6rem 1rem',
            borderRadius: 10,
            background: '#6366f1',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Go to sign in
        </a>
      </div>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
