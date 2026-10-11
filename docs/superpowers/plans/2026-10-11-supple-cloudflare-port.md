# supple Cloudflare Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the supple (Social Training Club) Python backend as a Cloudflare Worker (TS) + D1 + R2, serving the UNCHANGED front-end from the same origin, deployable free.

**Architecture:** One Worker serves static assets (frozen front-end) and `/api/*`. D1 holds the 6 relational tables; the workspace is a single JSON blob with an integer `revision` for optimistic concurrency. R2 holds uploaded videos, streamed back with Range support. Security model (PBKDF2, HttpOnly/SameSite/Secure cookies, CSRF + Origin checks, rate-limiting, client isolation, magic-byte video validation) ported 1:1 and re-tested.

**Tech Stack:** Cloudflare Workers, Wrangler 3+, D1 (SQLite), R2, TypeScript, WebCrypto, Vitest + `@cloudflare/vitest-pool-workers`.

## Global Constraints

- **Front-end FROZEN**: `index.html`, `app.js`, `member.js`, `auth.js`, `data.js`, `icons.js`, `styles.css`, `assets/**` are never modified. Design/UX byte-for-byte identical.
- **Same-origin** Worker (static + API) so existing cookie/CSRF model works untouched.
- **PBKDF2** SHA-256, 600_000 iterations, stored format `rounds$saltHex$digestHex`.
- **Password** min length 12; session cookie name `stc_session`; session TTL 7 days; invite TTL 72h.
- **Cookies**: `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`, plus `Secure` when origin is HTTPS (always true when hosted).
- **MAX_JSON** 3 MiB; **MAX_VIDEO** 50 MiB; video mimes: mp4/webm/ogg/quicktime; magic bytes per server.py.
- **Security headers** on every response, identical CSP to server.py:362-369.
- Source of truth for pure logic: existing `server.py` (validators 56-237, analytics 240-260, role view 310-336, member_action 802-904, leaderboard 753-793). Port behaviour EXACTLY.

---

### Task 1: Project scaffold + static serving + health

**Files:**
- Create: `wrangler.toml`, `package.json`, `tsconfig.json`, `.dev.vars.example`, `migrations/0001_init.sql`, `src/index.ts`, `src/router.ts`, `src/http.ts`
- Keep (frozen): `index.html`, `*.js`, `styles.css`, `assets/**`

**Interfaces:**
- Produces: `src/index.ts` default export `{ fetch(req, env, ctx) }`; `Env` type with bindings `DB: D1Database`, `VIDEOS: R2Bucket`, `ASSETS: Fetcher`, vars `STC_SETUP_TOKEN`, `STC_PUBLIC_ORIGIN`.
- Produces `json(value, status?, headers?)`, `securityHeaders()`, `APIError` in `src/http.ts`.

Wrangler config (assets + bindings):
```toml
name = "supple"
main = "src/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

assets = { directory = "./public", binding = "ASSETS" }

[[d1_databases]]
binding = "DB"
database_name = "supple"
database_id = "PLACEHOLDER_SET_BY_WRANGLER"

[[r2_buckets]]
binding = "VIDEOS"
bucket_name = "supple-videos"

[vars]
STC_PUBLIC_ORIGIN = ""
```

Front-end files move to `./public/` (git mv — content unchanged) so `assets` serves them; `index.html`, the 6 JS/CSS files, `assets/fonts/*`, `assets/*.png`, `logo.png`.

`migrations/0001_init.sql` = the 6 `CREATE TABLE` statements from server.py:287-294 (users, sessions, workspace, invitations, videos, events) **plus** `CREATE TABLE IF NOT EXISTS attempts(scope TEXT NOT NULL, ts INTEGER NOT NULL);` and `CREATE INDEX idx_attempts ON attempts(scope, ts);`.

`src/http.ts`:
```ts
export class APIError extends Error { constructor(public msg: string, public status = 400){ super(msg);} }
export function securityHeaders(origin: string): Record<string,string> {
  const h: Record<string,string> = {
    "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":"DENY",
    "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  };
  if (origin.startsWith("https://")) h["Strict-Transport-Security"] = "max-age=31536000";
  return h;
}
export function json(value: unknown, status = 200, extra: Record<string,string> = {}, origin = "") {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store", ...securityHeaders(origin), ...extra }});
}
```

- [ ] Step 1: `npm init -y`; add deps `wrangler`, `typescript`, `@cloudflare/workers-types`, `vitest`, `@cloudflare/vitest-pool-workers`; add scripts `dev`/`deploy`/`test`.
- [ ] Step 2: Write `tsconfig.json` (target ES2022, types `@cloudflare/workers-types`).
- [ ] Step 3: `mkdir public` and `git mv` the frozen front-end files into it (verify `git status` shows renames, not edits).
- [ ] Step 4: Write `wrangler.toml`, `migrations/0001_init.sql`, `src/http.ts`.
- [ ] Step 5: Write `src/index.ts` that routes `GET /api/health` → `json({status:"ok"})`; everything else `GET` → `env.ASSETS.fetch(req)` (static); unknown API → 404 json. Apply security headers to API responses.
- [ ] Step 6: `npx wrangler d1 create supple` (needs login — if not logged in, note for deploy task) then apply migration locally: `npx wrangler d1 execute supple --local --file migrations/0001_init.sql`.
- [ ] Step 7: `npx wrangler dev` (ARM64: use workerd recipe from memory). Verify `GET /api/health` → 200, `GET /` serves frozen index.html unchanged.
- [ ] Step 8: Commit.

---

### Task 2: Crypto + validators + analytics + role view (pure logic)

**Files:** Create `src/crypto.ts`, `src/validate.ts`, `src/analytics.ts`; Test `test/validate.test.ts`, `test/crypto.test.ts`.

**Interfaces:**
- Produces `passwordHash(pw): Promise<string>`, `passwordMatches(pw, stored): Promise<boolean>`, `tokenHash(t): Promise<string>` (sha256 hex), `timingSafeEqual(a,b): boolean` in `src/crypto.ts`.
- Produces `validateWorkspace(w): Workspace` (throws APIError), `text/number/date/email` validators in `src/validate.ts` — exact rules from server.py:56-237.
- Produces `analytics(w)`, `today()` (Europe/London) in `src/analytics.ts` (server.py:91-107, 240-260).
- Produces `viewFor(user, w)` role-filtered deep-copied view (server.py:310-336) — in `src/analytics.ts`.

WebCrypto PBKDF2 (replaces hashlib):
```ts
const ROUNDS = 600_000;
const enc = new TextEncoder();
function hex(b: ArrayBuffer){ return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }
function unhex(s: string){ return new Uint8Array(s.match(/../g)!.map(h=>parseInt(h,16))); }
async function pbkdf2(pw: string, salt: Uint8Array, rounds: number){
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt, iterations:rounds, hash:"SHA-256"}, key, 256);
  return hex(bits);
}
export async function passwordHash(pw: string){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${ROUNDS}$${hex(salt.buffer)}$${await pbkdf2(pw, salt, ROUNDS)}`;
}
export async function passwordMatches(pw: string, stored: string){
  try { const [r,s,d] = stored.split("$"); return timingSafeEqual(await pbkdf2(pw, unhex(s), +r), d); }
  catch { return false; }
}
export async function tokenHash(t: string){ return hex(await crypto.subtle.digest("SHA-256", enc.encode(t))); }
export function timingSafeEqual(a: string, b: string){ if(a.length!==b.length) return false; let v=0; for(let i=0;i<a.length;i++) v|=a.charCodeAt(i)^b.charCodeAt(i); return v===0; }
```

- [ ] Step 1: Write `test/crypto.test.ts`: hash round-trips, wrong pw fails, malformed stored → false, min-length enforced by caller. Run → fail.
- [ ] Step 2: Implement `src/crypto.ts`. Run → pass.
- [ ] Step 3: Write `test/validate.test.ts` porting key cases from server.py behaviour: valid minimal workspace passes; duplicate record IDs rejected; client referencing missing programme rejected; duplicate client emails rejected; session clients 1–6 enforced; measure kinds restricted; water counts bounded. Run → fail.
- [ ] Step 4: Port `src/validate.ts` + `src/analytics.ts` verbatim from server.py logic (translate Python→TS, same limits/messages). Run → pass.
- [ ] Step 5: Commit.

---

### Task 3: D1 data layer

**Files:** Create `src/db.ts`; Test `test/db.test.ts`.

**Interfaces (all async, take `env.DB`):**
- `getWorkspace(db): {w: Workspace, revision: number}` (throws APIError 409 if unset — server.py:304-308).
- `putWorkspace(db, json, expectedRevision): number|null` — CAS update `WHERE id=1 AND revision=?`, returns new revision or null on conflict.
- `initWorkspace(db, uid, email, hash, name, workspaceJson)` — the setup transaction (server.py:543-554) via `db.batch`.
- user helpers: `userByEmail`, `userById`, `insertUser`, `updatePassword`, `deleteUserSessions`.
- session helpers: `createSession(db, uid)→{raw, csrf}` (prune expired first), `sessionUser(db, tokenHash)→row|null` (JOIN users, expires>now), `deleteSession(db, tokenHash)`, `deleteOtherSessions(db, uid, keepCsrf)`.
- invite helpers: `putInvite`, `inviteClient(db, tokenHash)→clientId|null`, `deleteClientInvites`.
- video meta: `getVideoMeta`, `setVideoMeta`, `videoIdSet(db)`.
- events: `eventExists(db, uid, key)`, `insertEvent`.
- rate limit: `tooMany(db, ipScope, acctScope)→bool` + record (prune ts< now-900; ip≥100 or acct≥10 → true), `clearAttempts(db, acctScope)`.

D1 lacks `BEGIN IMMEDIATE`; emulate optimistic concurrency with CAS:
```ts
export async function putWorkspace(db: D1Database, data: string, expected: number){
  const r = await db.prepare("UPDATE workspace SET data=?, revision=revision+1 WHERE id=1 AND revision=?")
    .bind(data, expected).run();
  if (r.meta.changes === 0) return null;         // conflict → caller throws 409
  return expected + 1;
}
```

- [ ] Step 1: Write `test/db.test.ts` (Vitest workers pool, isolated D1): init→get round-trip; CAS returns null on stale revision; session create→lookup→delete; invite one-use; rate-limit thresholds. Run → fail.
- [ ] Step 2: Implement `src/db.ts`. Run → pass.
- [ ] Step 3: Commit.

---

### Task 4: Auth endpoints + request guards

**Files:** Create `src/auth.ts`, `src/guards.ts`; Modify `src/index.ts` (wire routes); Test `test/auth.test.ts`.

**Interfaces:**
- `checkOrigin(req, env)` — port server.py:396-406 (Origin must equal expected; reject `Sec-Fetch-Site: cross-site`).
- `authenticate(req, env, {coach?, write?})→user` — cookie → session lookup; on write: checkOrigin + CSRF header `X-CSRF-Token` timing-safe vs session csrf (server.py:408-431).
- `sessionCookie(raw, secure)→string`.
- Handlers: `authStatus`, `authSetup`, `authLogin`, `authLogout`, `acceptInvite`, `changePassword`, `inviteInfo` — 1:1 with server.py:504-666.

- [ ] Step 1: Write `test/auth.test.ts`: setup creates coach+workspace (201, sets cookie); second setup → 409; login good/bad (401); rate-limit after 10 bad account attempts (429); logout clears session; CSRF-less PUT rejected (403); cross-site Origin rejected; accept invite sets member password (201) and is one-use; wrong setup-token when hosted → 403. Run → fail.
- [ ] Step 2: Implement `src/guards.ts` + `src/auth.ts`; wire into router. Run → pass.
- [ ] Step 3: Commit.

---

### Task 5: Workspace read/write

**Files:** Create `src/workspace.ts`; Modify `src/index.ts`; Test `test/workspace.test.ts`.

**Interfaces:** `getWorkspaceHandler(user,env)` (role view + revision), `putWorkspaceHandler(user,req,env)` — coach-only; validate; CAS revision; enforce linked member email/client invariants (server.py:684-695); server-authoritative `ex.video` flags from `videoIdSet` (server.py:696-701).

- [ ] Step 1: Write `test/workspace.test.ts`: coach reads full workspace; **member view excludes other clients, coach notes, others' logs/meals/measures, activity** (explicit isolation asserts); member cannot PUT (403); stale revision → 409; changing a linked client's email → 409. Run → fail.
- [ ] Step 2: Implement. Run → pass. Step 3: Commit.

---

### Task 6: Invitations, member actions, leaderboard

**Files:** Create `src/member.ts`, `src/leaderboard.ts`; Modify `src/index.ts`; Test `test/member.test.ts`.

**Interfaces:** `createInvitation` (coach-only, replaces prior invite, 72h), `memberActions` (idempotent via events; actions workout/meal/water/result/checkin/privacy — server.py:802-904), `leaderboard` (consent filter, first-name+last-initial, deadlift/row bests — server.py:753-793).

- [ ] Step 1: Write `test/member.test.ts`: workout log requires all exercises complete + valid entries; idempotent key replays return current state without duplicate; water increments capped 200; result rejects non-whole-second row; privacy opt-in toggles; leaderboard hides non-opted-in members from other members but shows self; coach sees all. Run → fail.
- [ ] Step 2: Implement. Run → pass. Step 3: Commit.

---

### Task 7: Videos on R2

**Files:** Create `src/video.ts`; Modify `src/index.ts`; Test `test/video.test.ts`.

**Interfaces:** `uploadVideo(db,env,user,eid,req)` coach-only; mime allow-list; read body ≤50MiB; magic-byte check (server.py:913-917); write R2 object key=random; update `videos` + workspace `ex.video=true` (CAS); delete old R2 object. `serveVideo(db,env,eid,req,head)` — R2 `get` with Range → 206/200, `Content-Range`, `Accept-Ranges`, `private, no-store`.

R2 range read:
```ts
const rng = parseRange(req.headers.get("Range"), size); // {offset,length,start,end} or null→full
const obj = await env.VIDEOS.get(key, rng ? { range: { offset: rng.start, length: rng.end-rng.start+1 } } : undefined);
```

- [ ] Step 1: Write `test/video.test.ts`: non-coach upload 403; bad mime 415; non-video bytes 415; valid mp4 stores + flips flag; GET streams full (200) and Range (206 with Content-Range); missing video 404; oversize 413. Run → fail.
- [ ] Step 2: Implement `src/video.ts` + `parseRange`. Run → pass. Step 3: Commit.

---

### Task 8: Full integration smoke + security headers audit

**Files:** Test `test/integration.test.ts`.

- [ ] Step 1: End-to-end in one test: setup coach → add client+programme via PUT → invite → accept as member → member logs workout → coach sees log → leaderboard respects consent → upload+stream video. Assert security headers present on API + asset responses. Run → iterate to green.
- [ ] Step 2: Full suite `npm test` green. Commit.

---

### Task 9: Local browser verification (frozen UI)

- [ ] Step 1: `wrangler dev`; load `/` in Chrome. Confirm the EXACT same sign-in screen/branding as the Python version (compare to earlier screenshot). Create coach, add a client, create invite link, accept in a second session, log a workout, upload a short video, view leaderboard. Zero console errors.
- [ ] Step 2: Confirm no front-end file changed: `git diff --stat` touches only `public/` moves, never content. Commit a VERIFICATION.md note.

---

### Task 10: Deploy handoff (Dean's Cloudflare)

- [ ] Step 1: Dean runs `wrangler login` (interactive). 
- [ ] Step 2: `wrangler d1 create supple` → paste `database_id` into wrangler.toml; `wrangler r2 bucket create supple-videos`; `wrangler d1 execute supple --remote --file migrations/0001_init.sql`.
- [ ] Step 3: `wrangler secret put STC_SETUP_TOKEN` (random). Set `STC_PUBLIC_ORIGIN` after first deploy gives the workers.dev URL, or leave blank (cookies Secure inferred from request URL).
- [ ] Step 4: `wrangler deploy`. Open `https://supple.<subdomain>.workers.dev`, create coach account with the setup token, smoke test on phone.
- [ ] Step 5: Push repo to Dean's own GitHub; update MEMORY.md (new project entry, relation to coach-platform) + LGH HQ if relevant.
```
```

## Self-review notes
- Spec coverage: all 15 endpoints mapped (T4/5/6/7), security parity re-tested (T4/5/6/7/8), UI frozen (T1 move-only + T9 diff gate), free hosting (T1/T10), rate-limiting persisted (T3), isolation (T5 explicit). 
- Rate limiting moved from in-memory → D1 `attempts` table (Workers are stateless); noted as the one deliberate mechanism change, behaviour-equivalent.
- `today()` Europe/London: Workers support IANA TZ via `Intl`/`Date` with `timeZone`, so the server.py Windows fallback is unnecessary — use `Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'})`.
