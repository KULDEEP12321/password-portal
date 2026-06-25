# Design

## Theme

Refined dark — a calm, precise instrument. Near-black neutral charcoal (very faintly
cool, not blue-heavy), structured almost entirely by **1px hairline borders** and
**spacing** rather than shadows or fills. No gradients on surfaces or buttons, no
background glow, no glassmorphism. One restrained accent (iris/violet) carries primary
actions, selection, focus and links — nothing decorative. Elevation (shadow) is used
only for true overlays (modals, dropdowns).

Physical scene: a developer at their desk in normal room light, opening the vault for
a few focused seconds. The interface should feel quiet, legible, and trustworthy.

## Color

OKLCH-reasoned, expressed as hex tokens. Strategy: **Restrained** (tinted neutrals +
one accent, accent ≤ ~10% of surface).

Neutrals (cool-neutral charcoal ramp):
- `--bg` #0c0d11 (app background, flat — no blobs)
- `--surface` #16171d (panels, cards, header, rows-base)
- `--surface-2` #1c1e26 (raised / hover / inputs-on-panel)
- `--border` #2a2c36 (default hairline) · `--border-soft` #211f27 (interior dividers) · `--border-strong` #3a3d4a (focus-adjacent)
- `--text` #ededf1 (primary, ~13:1) · `--text-muted` #a9adba (secondary, ≥4.5:1) · `--text-faint` #828795 (captions/placeholders, ≥4.5:1 on surfaces)

Accent — iris/violet, used flat:
- `--accent` #7c6cf5 (primary action, current selection) · `--accent-hover` #8d7eff
- `--accent-text` #b9acff (links, accent text on dark) · `--accent-quiet` rgba(124,108,245,0.14) (selected/badge tint)
- `--ring` rgba(124,108,245,0.45) (focus ring, 3px)

Semantic (state only, never decoration):
- success #3ddc97 / tint rgba(61,220,151,0.13)
- danger #f4736f / tint rgba(244,115,111,0.13)
- warn #f0b54a / tint rgba(240,181,74,0.13)

Elevation: cards none (border does the work). Overlays `0 16px 40px -16px rgba(0,0,0,0.7)`.

## Typography

- One family: **Inter** (400/500/600/700) for all UI; **JetBrains Mono** (500) for
  secret values, IPs, ids. No display pairing.
- Fixed rem scale, ratio ~1.2 (not fluid/clamped): h1 1.5rem · h2 1.125rem ·
  body 0.875rem · small 0.8rem · caption 0.75rem.
- Weights: headings 600, labels 600, body 400–500. Page titles tracking -0.01em.
  `text-wrap: balance` on headings.

## Components

Consistent vocabulary across every screen. Radii: controls 9px, surfaces 14px, pills 999px.

- **Button** — flat. Primary: solid `--accent`, white text, hover `--accent-hover`.
  Secondary: `--surface-2` + border. Ghost: transparent → subtle bg on hover. Danger:
  red tint + red text. All show default/hover/active/focus(ring)/disabled.
- **Input / select / textarea** — `--surface-2` fill, `--border`, focus = accent
  border + 3px ring. Placeholder `--text-faint` (passes contrast).
- **Surface (card/panel)** — flat `--surface`, 1px `--border`, radius 14px, no shadow.
- **Table** — quiet header (small, `--text-faint`, not shouty caps), 1px row dividers,
  subtle row hover (`--surface-2` at low alpha). No per-row entrance animation.
- **Badge / tag** — flat, low-chroma; accent/success/danger variants by tint.
- **Modal** — solid scrim `rgba(8,8,11,0.66)` (minimal blur), card on `--surface` with
  overlay shadow. Used sparingly; inline/confirm patterns preferred.
- **Empty state** — teaches the screen, offers the next action.

## Layout

- App shell: solid top bar (`--surface` + hairline bottom border, no blur), max content
  width ~1040–1120px, generous horizontal gutters, vertical rhythm on an 8px base.
- Responsive is structural: tables scroll-x on small screens; header condenses labels.

## Motion

- 150–220ms, ease-out. Motion conveys **state** only: hover, focus, modal in/out,
  copy-confirm, spinner. No page-load choreography, no per-row reveals.
- Full `@media (prefers-reduced-motion: reduce)` path (instant / crossfade).
