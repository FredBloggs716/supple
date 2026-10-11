# Verification — supple Cloudflare port

Date: 2026-10-11

## Automated tests (49 passing)

`npm test` — Vitest on the real Workers runtime (workerd) with D1 + R2:

- `crypto` — PBKDF2 hash/verify, timing-safe compare, token hashing.
- `validate` — field validators + full workspace validation rules.
- `db` — workspace CAS revision, sessions, one-use invitations, rate limiting.
- `auth` — setup (token-gated when hosted), login/logout, CSRF rejection,
  10-attempt rate limit, one-use invite accept.
- `workspace` — role view **client isolation** (a member sees only their own
  client, no coach notes, no other clients' logs/meals/measures/activity),
  coach-only write, stale-revision conflict, linked-email guard.
- `member` — invite minting, idempotent member actions, water cap, result
  validation, leaderboard consent filtering.
- `video` — coach-only upload, mime + magic-byte checks, R2 store, range streaming.
- `integration` — full coach+member lifecycle end-to-end; security headers on
  API and static responses.

## Manual browser smoke (wrangler dev, real frozen front-end)

- Setup screen renders with identical STC branding.
- Created a coach account with sample data → coach dashboard rendered with
  12 clients, adherence/streak analytics, charts, schedule, leaderboard.
- Clients page rendered the full roster from D1.
- Zero console errors on load and navigation.

## Front-end integrity

`public/` front-end files are **byte-for-byte identical** to the original
`FredBloggs716/supple` upload (index.html, app.js, member.js, auth.js, data.js,
icons.js, styles.css, logo.png, assets/*). The design/UX was not changed; only
the backend was reimplemented.

## Not yet done

- Remote deploy to Cloudflare (needs the account owner to run
  `wrangler login`) — see DEPLOY-CLOUDFLARE.md.
