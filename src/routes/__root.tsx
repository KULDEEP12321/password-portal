import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

// Set the theme before first paint (no flash). Resolves the saved preference,
// falling back to the OS setting, and writes data-theme on <html>.
const THEME_INIT = `(function(){try{var m=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=(m==='light'||m==='dark')?m:(d?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Vault · Secrets Portal' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  errorComponent: RootErrorComponent,
  shellComponent: RootDocument,
})

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg, #0c0d11)',
        color: 'var(--text, #ededf1)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          border: '1px solid var(--border, #2a2c36)',
          borderRadius: 14,
          background: 'var(--panel, #16171d)',
          padding: '1.75rem',
        }}
      >
        <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-soft, #a9adba)',
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
            borderRadius: 9,
            background: 'var(--accent, #5c4ee0)',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
