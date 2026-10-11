# supple — Cloudflare free-tier port (design)

**Date:** 2026-10-11
**Goal:** Host the existing, working "Social Training Club" coach/client app online for £0 with persistent data, without changing its design or UX.

## Context

The app (`FredBloggs716/supple`, now copied to `~/Projects/supple`) is a self-contained
Python stdlib HTTP server (`server.py`) + vanilla-JS front-end. It was verified to run
correctly on Windows (server, API, auth, DB, browser UI all pass; only the test suite's
Windows teardown errors, a cosmetic file-lock issue).

It cannot run on Netlify or any free "static + serverless" host unchanged, because it needs
a **long-running process + persistent disk** (SQLite DB + uploaded video files). Free tiers
on Render/Railway/Fly give ephemeral disk → data loss.

## Decision

Reimplement the backend on **Cloudflare Workers + D1 + R2** (free tier, persistent, and the
same stack already used for Howson Clock / Howson Maintenance).

## HARD CONSTRAINTS

1. **Front-end is frozen.** `index.html`, `app.js`, `member.js`, `auth.js`, `data.js`,
   `icons.js`, `styles.css`, `assets/**` (fonts, logos) are **not modified**. The design,
   layout, branding and UX stay byte-for-byte identical. Only the backend is rewritten.
   (Per Dean's standing rule on ported apps.)
2. **Same-origin.** The Worker serves both the static front-end and the `/api/*` routes from
   one origin, so the existing cookie + CSRF + Origin/Sec-Fetch model keeps working with no
   front-end changes.
3. **Security parity.** Every protection in `server.py` must survive the port and be
   re-verified, not assumed: salted PBKDF2 password hashing, HttpOnly/SameSite/Secure session
   cookies, CSRF token check on writes, Origin/Sec-Fetch-Site checks, login rate-limiting,
   strict client data isolation (members never see other clients' data or coach notes),
   path/asset restriction, video magic-byte validation, optimistic-concurrency revision check.

## Architecture

Single Worker, same-origin:

- **Static assets** — served via Workers static assets (Wrangler `assets` binding) for the
  frozen front-end files + fonts + logos.
- **`/api/*`** — handled by the Worker (TypeScript).
- **D1** — relational store for the 6 existing tables: `users`, `sessions`, `workspace`
  (single JSON blob + revision), `invitations`, `videos` (metadata), `events`
  (member action idempotency keys).
- **R2** — binary store for uploaded exercise videos; streamed back with HTTP Range support.

### Endpoint map (ported 1:1 from server.py)

| Method & path | Purpose |
|---|---|
| GET `/api/health` | liveness |
| GET `/api/auth/status` | setup state / current user + csrf |
| POST `/api/auth/setup` | create the one coach account + seed workspace (setup token when hosted) |
| POST `/api/auth/login` | coach/member login (rate-limited) |
| POST `/api/auth/logout` | end session |
| GET `/api/invitations/:token` | preview an invite |
| POST `/api/auth/accept` | client accepts invite, sets password |
| POST `/api/password` | change own password |
| GET `/api/workspace` | read workspace (role-filtered view) |
| PUT `/api/workspace` | coach saves workspace (revision-checked) |
| POST `/api/invitations` | coach creates client invite |
| POST `/api/member/actions` | member logs workout/meal/water/result/checkin/privacy (idempotent) |
| GET `/api/leaderboard` | consent-filtered rankings |
| POST `/api/videos/:exercise` | coach upload video (→ R2) |
| GET/HEAD `/api/videos/:exercise` | stream video (Range) from R2 |

### Key translation notes

- **PBKDF2:** Python `hashlib.pbkdf2_hmac` → WebCrypto `crypto.subtle` (PBKDF2, SHA-256,
  600k iterations). Same stored format `rounds$salt$digest`. `hmac.compare_digest` →
  constant-time compare helper.
- **Workspace validation:** port `validate_workspace` + `analytics` + role `view` logic
  verbatim (pure functions over the JSON blob) — this is where client isolation lives.
- **Transactions / revision check:** `BEGIN IMMEDIATE` optimistic concurrency → D1 batch +
  compare-and-set on `revision` (re-read, verify, conditional update).
- **Rate limiting:** in-memory dict in Python → D1-backed (or Durable Object if needed) so it
  survives the stateless Worker model. Start with a small D1 `attempts` table keyed by
  ip/account with timestamp pruning.
- **Setup token / public origin:** Worker env vars (`STC_SETUP_TOKEN`, derived origin).
  Hosted origin is always HTTPS → cookies always `Secure`.

## Out of scope

- No front-end changes of any kind.
- No new features beyond what server.py already does.
- No data migration from the local demo DB (greenfield — coach account created live).
- Custom domain (can add later; v1 uses `*.workers.dev`).

## Deployment

- Local dev + test with `wrangler dev` (note: Windows-on-ARM64 needs the workerd recipe).
- Deploy requires Dean to run `wrangler login` himself (interactive browser auth); then
  `wrangler deploy`. D1 + R2 created via wrangler. Setup token set as a secret.
- Repo pushed to Dean's own GitHub (currently under third-party `FredBloggs716`).

## Testing / verification

- Port `tests/test_server.py` coverage to the Worker (Vitest + `@cloudflare/vitest-pool-workers`
  or Miniflare): setup/login/logout, one-use invitations, client isolation, CSRF rejection,
  revision conflict, idempotent member logs, video upload/range, password change, login limits.
- Manual browser smoke against `wrangler dev` with the real (frozen) front-end before deploy.
- Explicit re-check: a member API response never contains another client's records or coach notes.
