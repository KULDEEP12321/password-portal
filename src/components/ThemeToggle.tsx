import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type Mode = 'system' | 'light' | 'dark'

function resolve(mode: Mode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

const OPTIONS: { value: Mode; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'System theme', icon: <Monitor size={15} /> },
  { value: 'light', label: 'Light theme', icon: <Sun size={15} /> },
  { value: 'dark', label: 'Dark theme', icon: <Moon size={15} /> },
]

/** Compact System / Light / Dark segmented control. Persists to localStorage and
 *  drives the `data-theme` attribute the stylesheet reads. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system')

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    setMode(stored === 'light' || stored === 'dark' ? stored : 'system')
  }, [])

  // While following the OS, react to OS theme changes live.
  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => document.documentElement.setAttribute('data-theme', resolve('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  function choose(next: Mode) {
    setMode(next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* storage unavailable */
    }
    document.documentElement.setAttribute('data-theme', resolve(next))
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--panel-2)',
      }}
    >
      {OPTIONS.map((o) => {
        const active = mode === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => choose(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 26,
              width: 28,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--accent-bg)' : 'transparent',
              color: active ? 'var(--accent-soft)' : 'var(--text-faint)',
              transition: 'background-color 140ms ease, color 140ms ease',
            }}
          >
            {o.icon}
          </button>
        )
      })}
    </div>
  )
}
