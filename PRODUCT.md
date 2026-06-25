# Product

## Register

product

## Users

Internal team members at a small company — developers, ops, founders. They open the
vault occasionally during the workday, at a desk, in a focused and slightly
security-conscious mood, to grab or store a shared credential and get back to work.
Roles: **admins** manage users / projects / audit, **editors** manage secrets,
**viewers** read. Secrets are organized into private, per-member **Projects**.

## Product Purpose

A self-hosted, end-to-end-encrypted secrets manager (AES-256-GCM at rest in
Cloudflare R2, running on Cloudflare Workers). Success looks like: a teammate trusts
it on sight, finds and reveals the right secret in seconds, always knows which
project they're in, and never wonders whether the tool itself is safe.

## Brand Personality

Precise, calm, trustworthy. A quiet instrument, not a flashy app. The voice is plain
and exact ("Reveal", "encrypted at rest with AES-256-GCM") — never playful, never
salesy. Confidence is shown through restraint.

## Anti-references

- **Generic "dark SaaS"**: indigo gradients, glowing background blobs, glassmorphism,
  heavy drop-shadows. Looks templated and undermines trust in a security tool.
- **Consumer password managers** that lean cute / skeuomorphic (keys, padlock art).
- **Crypto / web3 dashboards**: neon, hype, gradients. This is infrastructure, not a casino.

## Design Principles

1. **The tool disappears into the task.** Earned familiarity over novelty; standard
   affordances, no invented controls.
2. **Calm conveys security.** Legibility, precision and restraint signal
   trustworthiness far more than locks-and-shields decoration.
3. **Hierarchy by structure, not decoration.** Borders, spacing and weight carry the
   layout; saturated color is reserved for action and state.
4. **Every state is designed** — default, hover, focus, disabled, loading, empty,
   error — and consistent across every screen.
5. **Reveal is the moment.** The one interaction that earns a touch of emphasis;
   everything around it stays quiet.

## Accessibility & Inclusion

WCAG AA: body ≥ 4.5:1, large/secondary text ≥ 3:1, placeholders ≥ 4.5:1. A visible
focus ring on every interactive element. Honor `prefers-reduced-motion`. Never rely on
color alone for state — always pair with an icon or text label.
