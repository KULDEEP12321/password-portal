# Vault — Internal Secrets & Password Portal

> 🔗 **Live:** https://password-portal.seoexpertup.workers.dev
> &nbsp;·&nbsp; Deployed on **Cloudflare Workers**, secrets stored in **Cloudflare R2**, encrypted with **AES-256-GCM**.

A production-grade internal portal for storing and retrieving passwords, API keys,
access tokens, and other credentials, built with **TanStack Start** (React 19) and
deployed to **Cloudflare Workers**. Every secret is **encrypted with AES-256-GCM on
the server before it is written to Cloudflare R2** — the encryption key and storage
credentials live only in server-side secrets and are never exposed to the browser.

**Tech stack:** TanStack Start · React 19 · TypeScript · Tailwind CSS v4 · Cloudflare
Workers · Cloudflare R2 · Zod · bcrypt · sealed-cookie sessions.

> ℹ️ The live app is **login-gated** (no public demo credentials). Follow
> [Quick start](#quick-start) to run it locally, or [Deployment](#deployment-cloudflare-workers)
> to deploy your own.

---

## Table of contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Security model](#security-model)
4. [Quick start](#quick-start)
5. [Environment variables](#environment-variables)
6. [Cloudflare R2 setup](#cloudflare-r2-setup)
7. [Roles & permissions](#roles--permissions)
8. [API surface (server functions)](#api-surface-server-functions)
9. [Storage layout](#storage-layout)
10. [Deployment](#deployment)
11. [Maintenance & operations](#maintenance--operations)
12. [Security checklist & limitations](#security-checklist--limitations)
13. [Troubleshooting](#troubleshooting)

---

## Features

- 🔐 **Encrypted at rest** — every secret value (and notes) is encrypted with
  AES-256-GCM before storage. Plaintext never touches the database.
- ☁️ **Cloudflare R2 storage** — backend talks to R2 over the S3 API; a local
  filesystem driver is used automatically when R2 isn't configured (for dev).
- 👁️ **Reveal on demand** — values are masked by default; the eye button decrypts
  through a secure, authenticated, rate-limited, audited backend call.
- 🔎 **Search & filter** — by name, username, URL, type, or tag.
- 📋 **Copy to clipboard**, **show/hide**, and a **strong-value generator**.
- 👥 **Authentication & RBAC** — sealed-cookie sessions; `admin` / `editor` /
  `viewer` roles enforced on the server.
- 🔑 **Self-service password change** — any signed-in user can rotate their own
  password from the dashboard (verifies the current password first).
- 📝 **Audit log** — every login, reveal, create, update, delete, and user change
  is recorded with actor, target, IP, and timestamp.
- 🧱 **Clean architecture** — strict separation of UI, server functions, domain
  services, and the storage layer; reusable components and utilities.
- 🛡️ **Hardened** — Zod input validation, per-IP/per-user rate limiting,
  bcrypt password hashing, httpOnly/secure/sameSite cookies, path-traversal-safe
  storage keys, `noindex` headers.

---

## Architecture

```
Browser (React UI, no secrets, no keys)
   │   type-safe server-function calls (RPC over HTTPS)
   ▼
src/fn/*           ← server functions: auth, secrets, audit, users
   │                 (authenticate → authorize → validate → audit)
   ▼
src/server/*       ← server-only domain + infrastructure
   ├── session.ts     sealed-cookie sessions, requireUser(role)
   ├── users.ts       accounts, bcrypt, bootstrap admin
   ├── secrets.ts     secret records, encrypt/decrypt orchestration
   ├── audit.ts       append-only audit log
   ├── crypto.ts      AES-256-GCM (key from env, never leaves server)
   ├── ratelimit.ts   in-memory sliding-window limiter
   ├── schemas.ts     Zod validation/sanitization
   └── storage/       object-storage abstraction
        ├── r2.ts       Cloudflare R2 (S3 API) — production
        └── local.ts    filesystem — dev fallback
   ▼
Cloudflare R2 bucket (encrypted JSON objects)
```

**Boundary guarantee:** the `tanstack-start` Vite plugin strips server-function
handler bodies from the client bundle. The build was verified to contain **no**
AWS SDK, bcrypt, `node:crypto`, encryption key, or R2 credential in the browser
output. Routes/components import only `src/fn/*` and `src/types.ts`.

### Project structure

```
src/
  types.ts                 Shared, client-safe types (no server imports)
  router.tsx               TanStack Router setup
  styles.css               Design system (Tailwind v4 + tokens)
  components/
    ui.tsx                 Button, Modal, Field, Badge, Alert, EmptyState…
    SecretForm.tsx         Create/edit modal (+ strong-value generator)
    SecretRow.tsx          Table row with reveal/copy
  lib/
    clipboard.ts  format.ts  errors.ts
  fn/                      Server functions (the API layer)
    auth.ts  secrets.ts  audit.ts  users.ts
  server/                  Server-only code (see diagram above)
  routes/
    __root.tsx  index.tsx  login.tsx
    dashboard/
      route.tsx            Protected layout (auth gate + nav)
      index.tsx            Secrets dashboard
      audit.tsx            Audit log (admin)
      users.tsx            User management (admin)
```

---

## Security model

| Concern | Approach |
| --- | --- |
| Secret confidentiality | AES-256-GCM. Random 96-bit IV per value; 128-bit auth tag detects tampering. Key from `MASTER_ENCRYPTION_KEY` (32 bytes, base64), held only in server memory. |
| What's encrypted | The **value** and **notes**. Name/type/username/URL/tags are stored as cleartext metadata so the dashboard can list and search without decrypting. |
| Passwords | bcrypt (cost 12). Plaintext never stored. Login does a constant-work comparison even for unknown users to resist username enumeration. |
| Sessions | TanStack Start sealed sessions — the cookie is encrypted+signed with `SESSION_PASSWORD`, `httpOnly`, `sameSite=lax`, and `Secure` in production. Only `{userId, username, role}` is stored; re-validated against storage on every request. |
| Authorization | Every server function calls `requireUser([roles])`. Writes require `admin`/`editor`; audit & user management require `admin`. |
| Reveal control | Decryption happens only in `revealSecret`, only for authenticated users, rate-limited per user, and written to the audit log. |
| Input handling | Zod validates and length-caps every payload. Storage keys are UUID-based and the local driver rejects path traversal. |
| Rate limiting | Login throttled per-IP (10 / 5 min), per-account (10 / 5 min), and globally (100 / min); reveal per-user (60 / min). Client IP comes from the socket unless `TRUST_PROXY=true`, so the limit can't be bypassed by spoofing `X-Forwarded-For`. |
| Transport | Cookies are `Secure` in production; deploy behind HTTPS. Pages send `noindex,nofollow`. |

---

## Quick start

> **Node ≥ 22 is required** — the Cloudflare build and wrangler need it (`nvm use 22`).

`npm run dev` runs the app in the **Workers runtime** (workerd, via Vite) with a
local R2 simulation and secrets from `.dev.vars` (git-ignored; generated for you,
template in `.dev.vars.example`). No Cloudflare account needed for local dev.

```bash
npm install      # already done during setup
npm run dev      # http://localhost:3000  (workerd + local R2)
```

Sign in with the bootstrap admin from `.dev.vars`:

- **Username:** `admin`
- **Password:** the `ADMIN_PASSWORD` value in `.dev.vars`

The admin account is created automatically on first run when no users exist yet.

Other scripts:

```bash
npm run build      # build the Worker → dist/
npm run deploy     # vite build && wrangler deploy   (see Deployment)
npm run typecheck  # tsc --noEmit
```

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MASTER_ENCRYPTION_KEY` | ✅ | AES-256 key, **32 bytes base64**. `openssl rand -base64 32`. Rotating it makes existing secrets unreadable — see [Maintenance](#maintenance--operations). |
| `SESSION_PASSWORD` | ✅ | Seals the session cookie. **≥ 32 chars.** `openssl rand -hex 32`. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | first run | Bootstrap admin, created when no users exist. `ADMIN_NAME` optional. |
| `STORAGE_DRIVER` | – | `r2binding` (Workers R2 binding — the deployed default), `r2` (S3 API), or `local` (dev fs). Set to `r2binding` in `wrangler.jsonc`. |
| `R2_ACCOUNT_ID` | for R2 | Cloudflare account id (endpoint is derived from it). |
| `R2_ENDPOINT` | alt | Full endpoint, e.g. `https://<id>.r2.cloudflarestorage.com` (use instead of account id). |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | for R2 | R2 API token credentials. |
| `R2_BUCKET` | for R2 | Bucket name. |
| `R2_REGION` | – | Defaults to `auto`. |
| `COOKIE_SECURE` | – | Defaults to **secure** (`true`). Set `false` **only** for local http dev. |
| `TRUST_PROXY` | – | `true` to trust `X-Forwarded-For` for client IP (rate-limit/audit). Enable **only** behind a proxy you control. Default `false` (socket IP). |
| `SESSION_COOKIE_NAME` | – | Defaults to `pp_session`. |
| `SESSION_MAX_AGE_SEC` | – | Session lifetime, default `28800` (8 h). |
| `LOCAL_STORAGE_DIR` | – | Local driver directory, default `.data`. |
| `APP_NAME` | – | Branding, default `Vault`. |

See `.env.example` for a copy-paste template.

---

## Cloudflare R2 setup

The endpoint URL alone **cannot** authenticate — you must create API credentials:

1. Cloudflare dashboard → **R2** → create a bucket (e.g. `secret-key-2026`).
2. **R2** → **Manage R2 API Tokens** → **Create API token** with
   **Object Read & Write** scoped to that bucket.
3. Copy the **Access Key ID** and **Secret Access Key**.
4. In `.env`, set and switch the driver:

   ```env
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=807c3a109357029cbeb1ab890dc435aa
   R2_BUCKET=secret-key-2026
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   ```

   (Or set `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` instead of
   `R2_ACCOUNT_ID`.)
5. Restart. New writes go to R2. R2 keeps your bucket private by default — never
   make it public.

---

## Roles & permissions

| Capability | admin | editor | viewer |
| --- | :---: | :---: | :---: |
| List / search secrets | ✅ | ✅ | ✅ |
| Reveal & copy values | ✅ | ✅ | ✅ |
| Create / edit / delete secrets | ✅ | ✅ | — |
| View audit log | ✅ | — | — |
| Manage users | ✅ | — | — |

Roles are assigned when creating a user (admin → **Users** → **Add user**). The
last remaining admin and your own account cannot be deleted.

---

## API surface (server functions)

In TanStack Start, server functions **are** the secure API — they compile to
authenticated RPC endpoints; their bodies run only on the server.

| Function (`src/fn/…`) | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `meFn` | GET | – | Current user (or null); bootstraps admin on first run |
| `loginFn` | POST | – | Authenticate, set session (rate-limited) |
| `logoutFn` | POST | session | Clear session |
| `listSecretsFn` | GET | any role | Secret **metadata** (never values) |
| `revealSecretFn` | POST | any role | Decrypt one value (rate-limited, audited) |
| `createSecretFn` | POST | admin/editor | Create (encrypts before store) |
| `updateSecretFn` | POST | admin/editor | Update (re-encrypts) |
| `deleteSecretFn` | POST | admin/editor | Delete record |
| `listAuditFn` | GET | admin | Recent audit entries |
| `listUsersFn` | GET | admin | List users (no hashes) |
| `createUserFn` | POST | admin | Create user (bcrypt) |
| `deleteUserFn` | POST | admin | Delete user (guards self/last admin) |

---

## Storage layout

```
secrets/<uuid>.json       Encrypted secret record  { value:{iv,tag,data}, notes?, …metadata }
users/<username>.json     User record              { id, role, passwordHash, … }
audit/<iso>__<uuid>.json  Append-only audit entry  (ISO-timestamp key = chronological)
```

All objects are JSON. Only `value`/`notes` inside `secrets/*` are ciphertext.

---

## Deployment (Cloudflare Workers)

Configured for **Cloudflare Workers** via `@cloudflare/vite-plugin` + `wrangler.jsonc`.
Storage uses a native **R2 binding** (`SECRETS_BUCKET`) — no S3 keys required.
**Requires Node ≥ 22.**

### Steps

```bash
# 1. Authenticate (opens a browser) — or export CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
npx wrangler login

# 2. Create the R2 bucket named in wrangler.jsonc
npx wrangler r2 bucket create secret-key-2026

# 3. Build + deploy (creates the Worker)
npm run deploy

# 4. Set the secrets (encrypted at rest, never committed). Re-run per value:
printf '%s' "$(openssl rand -base64 32)" | npx wrangler secret put MASTER_ENCRYPTION_KEY
printf '%s' "$(openssl rand -hex 32)"    | npx wrangler secret put SESSION_PASSWORD
printf '%s' '<choose-a-strong-password>' | npx wrangler secret put ADMIN_PASSWORD
```

The Worker is then live at `https://password-portal.<your-subdomain>.workers.dev`.
Sign in as `admin` with the `ADMIN_PASSWORD` you set.

### Config split
- **`wrangler.jsonc` → `vars`** — non-sensitive (`APP_NAME`, `STORAGE_DRIVER=r2binding`,
  `COOKIE_SECURE=true`, `TRUST_PROXY=false`, session settings, `ADMIN_USERNAME`).
- **`wrangler secret put`** — sensitive (`MASTER_ENCRYPTION_KEY`, `SESSION_PASSWORD`,
  `ADMIN_PASSWORD`). With `nodejs_compat`, both vars and secrets appear on `process.env`.
- **R2 binding** `SECRETS_BUCKET` → your bucket, accessed via `cloudflare:workers`.

### Notes
- **Back up** the bucket and store `MASTER_ENCRYPTION_KEY` in a separate secrets
  manager — **if it is lost, stored secrets are unrecoverable.**
- Client IP (rate-limit/audit) uses `CF-Connecting-IP`, set by Cloudflare and not
  client-spoofable.
- ⚠️ The in-memory rate limiter is **per-isolate** on Workers. For robust global
  brute-force protection, back `src/server/ratelimit.ts` with a **Durable Object**
  or **KV**; bcrypt(12) still slows attacks per-isolate in the meantime.
- Custom domain: add a `routes`/`route` entry to `wrangler.jsonc` or map it in the
  Cloudflare dashboard.

---

## Maintenance & operations

- **Rotating `MASTER_ENCRYPTION_KEY`:** the scheme stores a `v` (version) on every
  payload to support rotation. The current build uses a single key — re-encrypting
  existing records under a new key requires a migration script (decrypt with old,
  encrypt with new). Don't change the key without migrating, or stored secrets
  become unreadable.
- **Rotating `SESSION_PASSWORD`:** invalidates all sessions (everyone re-logs in).
- **Backups:** snapshot the R2 bucket regularly. Records are self-contained JSON.
- **Audit retention:** entries are immutable objects under `audit/`. Archive or
  prune old prefixes as needed; the UI loads the most recent events.
- **Resetting local dev:** delete `./.data`.

---

## Security checklist & limitations

Implemented: AES-256-GCM at rest · key/credentials server-only · bcrypt · sealed
httpOnly/secure/sameSite sessions · server-side RBAC on every endpoint · Zod
validation + length caps · per-IP login + per-user reveal rate limits · audit
logging · path-traversal-safe keys · username-enumeration-resistant login ·
`noindex`.

Known limitations to plan for:

- **Rate limiter is in-memory** — effective on a single instance only. For
  multi-instance/serverless, back `src/server/ratelimit.ts` with Redis/KV/Durable
  Objects (the interface is unchanged).
- **`listSecrets`/`listAudit` read each object** — fine for hundreds/low-thousands
  of records; introduce an index or a database for larger scale.
- **No built-in MFA / SSO** — add an IdP (OIDC/SAML) in front for stronger auth.
- **Secret versioning/history** is not stored; updates overwrite in place.
- **No optimistic concurrency on writes** — two admins/editors editing the *same*
  secret (or creating the same username) concurrently is last-writer-wins. Add an
  etag/version compare to the storage layer if concurrent edits are expected.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing required environment variable: MASTER_ENCRYPTION_KEY` | Copy `.env.example` → `.env` and fill keys (`openssl rand -base64 32`). |
| `MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes` | Use a base64 value of 32 raw bytes. |
| `SESSION_PASSWORD must be at least 32 characters` | Use `openssl rand -hex 32`. |
| Login succeeds but immediately bounces to `/login` (local) | Set `COOKIE_SECURE=false` for http localhost. |
| Secrets show but reveal fails after changing the key | The value was encrypted with the old key — restore it or migrate. |
| Using R2 but data still lands in `.data` | Ensure all `R2_*` vars are set and `STORAGE_DRIVER=r2`; restart. |
| Engine warning about Node 22 | Dev works on Node 20.19+; install Node 22 for production builds. |
