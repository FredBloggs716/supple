// D1 data layer. Ports server.py's SQL (schema at server.py:287-294) and the
// optimistic-concurrency / session / invitation / rate-limit logic.
import { APIError } from "./http";
import { randomToken, tokenHash } from "./crypto";

const SESSION_TTL = 7 * 86400;
const INVITE_TTL = 72 * 3600;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// ---- workspace --------------------------------------------------------------

export async function getWorkspace(db: D1Database): Promise<{ w: any; revision: number }> {
  const row = await db
    .prepare("SELECT data,revision FROM workspace WHERE id=1")
    .first<{ data: string; revision: number }>();
  if (!row) throw new APIError("Set up your club first.", 409);
  return { w: JSON.parse(row.data), revision: row.revision };
}

// Compare-and-set on revision (replaces server.py's BEGIN IMMEDIATE). Returns the
// new revision, or null if another write landed first (caller throws 409).
export async function putWorkspace(
  db: D1Database,
  data: string,
  expected: number,
): Promise<number | null> {
  const r = await db
    .prepare("UPDATE workspace SET data=?, revision=revision+1 WHERE id=1 AND revision=?")
    .bind(data, expected)
    .run();
  return r.meta.changes === 0 ? null : expected + 1;
}

export async function coachExists(db: D1Database): Promise<boolean> {
  return !!(await db.prepare("SELECT 1 FROM users WHERE role='coach'").first());
}

// Atomic club creation: coach user + workspace row (revision 1).
export async function createClub(
  db: D1Database,
  uid: string,
  email: string,
  passwordHash: string,
  name: string,
  workspaceJson: string,
): Promise<void> {
  try {
    await db.batch([
      db
        .prepare("INSERT INTO users VALUES(?,?,?,?,?,?)")
        .bind(uid, email, passwordHash, "coach", null, name),
      db.prepare("INSERT INTO workspace VALUES(1,?,1)").bind(workspaceJson),
    ]);
  } catch {
    // UNIQUE(email) or workspace PK(id=1) collision => someone set up first.
    throw new APIError("This club is already set up. Sign in instead.", 409);
  }
}

// ---- users ------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  password: string;
  role: string;
  client: string | null;
  name: string;
  csrf?: string;
}

export function userByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE email=?").bind(email).first<UserRow>();
}

export async function userExistsByClient(db: D1Database, clientId: string): Promise<boolean> {
  return !!(await db.prepare("SELECT 1 FROM users WHERE client=?").bind(clientId).first());
}

export async function insertUser(db: D1Database, u: UserRow): Promise<void> {
  await db
    .prepare("INSERT INTO users VALUES(?,?,?,?,?,?)")
    .bind(u.id, u.email, u.password, u.role, u.client, u.name)
    .run();
}

export async function updatePassword(db: D1Database, uid: string, hash: string): Promise<void> {
  await db.prepare("UPDATE users SET password=? WHERE id=?").bind(hash, uid).run();
}

// ---- sessions ---------------------------------------------------------------

export async function createSession(
  db: D1Database,
  uid: string,
): Promise<{ raw: string; csrf: string }> {
  const raw = randomToken(32);
  const csrf = randomToken(32);
  await db.prepare("DELETE FROM sessions WHERE expires<=?").bind(now()).run();
  await db
    .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .bind(await tokenHash(raw), uid, csrf, now() + SESSION_TTL)
    .run();
  return { raw, csrf };
}

export function sessionUser(db: D1Database, tHash: string): Promise<UserRow | null> {
  return db
    .prepare(
      "SELECT users.*, sessions.csrf FROM sessions JOIN users ON users.id=sessions.user WHERE sessions.token=? AND sessions.expires>?",
    )
    .bind(tHash, now())
    .first<UserRow>();
}

export async function deleteSession(db: D1Database, tHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token=?").bind(tHash).run();
}

export async function deleteUserSessions(db: D1Database, uid: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user=?").bind(uid).run();
}

export async function deleteOtherSessions(
  db: D1Database,
  uid: string,
  keepCsrf: string,
): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user=? AND csrf<>?").bind(uid, keepCsrf).run();
}

// ---- invitations ------------------------------------------------------------

// Replaces any prior invite for this client and returns the raw token (72h).
export async function createInvite(db: D1Database, client: string): Promise<{ raw: string; expires: number }> {
  const raw = randomToken(32);
  const expires = now() + INVITE_TTL;
  await db.batch([
    db.prepare("DELETE FROM invitations WHERE client=?").bind(client),
    db.prepare("INSERT INTO invitations VALUES(?,?,?)").bind(await tokenHash(raw), client, expires),
  ]);
  return { raw, expires };
}

export function inviteClient(db: D1Database, tHash: string): Promise<{ client: string } | null> {
  return db
    .prepare("SELECT client FROM invitations WHERE token=? AND expires>?")
    .bind(tHash, now())
    .first<{ client: string }>();
}

export async function deleteClientInvites(db: D1Database, client: string): Promise<void> {
  await db.prepare("DELETE FROM invitations WHERE client=?").bind(client).run();
}

// ---- videos -----------------------------------------------------------------

export function getVideoMeta(
  db: D1Database,
  eid: string,
): Promise<{ file: string; mime: string } | null> {
  return db
    .prepare("SELECT file,mime FROM videos WHERE exercise=?")
    .bind(eid)
    .first<{ file: string; mime: string }>();
}

export async function setVideoMeta(
  db: D1Database,
  eid: string,
  file: string,
  mime: string,
): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO videos VALUES(?,?,?)")
    .bind(eid, file, mime)
    .run();
}

export async function videoIdSet(db: D1Database): Promise<Set<string>> {
  const rows = await db.prepare("SELECT exercise FROM videos").all<{ exercise: string }>();
  return new Set(rows.results.map((r) => r.exercise));
}

// ---- member action idempotency ---------------------------------------------

export function eventExists(db: D1Database, uid: string, key: string): Promise<unknown | null> {
  return db.prepare("SELECT 1 FROM events WHERE user=? AND key=?").bind(uid, key).first();
}

export async function insertEvent(db: D1Database, uid: string, key: string): Promise<void> {
  await db.prepare("INSERT INTO events VALUES(?,?)").bind(uid, key).run();
}

// ---- login rate limiting (server.py:448-463) --------------------------------

// Prune the 15-min window, then block if ip>=100 or account>=10 prior attempts.
// Records this attempt when allowed. Throws 429 when over the limit.
export async function limitLogin(db: D1Database, ipScope: string, acctScope: string): Promise<void> {
  const cutoff = now() - 900;
  await db.prepare("DELETE FROM attempts WHERE ts<=?").bind(cutoff).run();
  const ip = await db
    .prepare("SELECT COUNT(*) AS n FROM attempts WHERE scope=?")
    .bind(ipScope)
    .first<{ n: number }>();
  const acct = await db
    .prepare("SELECT COUNT(*) AS n FROM attempts WHERE scope=?")
    .bind(acctScope)
    .first<{ n: number }>();
  if ((ip?.n ?? 0) >= 100 || (acct?.n ?? 0) >= 10) {
    throw new APIError("Too many attempts. Try again in 15 minutes.", 429);
  }
  await db.batch([
    db.prepare("INSERT INTO attempts VALUES(?,?)").bind(ipScope, now()),
    db.prepare("INSERT INTO attempts VALUES(?,?)").bind(acctScope, now()),
  ]);
}

export async function clearAccountAttempts(db: D1Database, acctScope: string): Promise<void> {
  await db.prepare("DELETE FROM attempts WHERE scope=?").bind(acctScope).run();
}
