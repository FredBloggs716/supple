// Auth + account endpoints. Ports server.py:504-666.
import { APIError, json, readJson } from "./http";
import { Env, publicOrigin, isLocalSetup, cookieSecure } from "./env";
import {
  coachExists,
  createClub,
  createSession,
  userByEmail,
  updatePassword,
  deleteOtherSessions,
  deleteUserSessions,
  insertUser,
  deleteSession,
  createInvite,
  inviteClient,
  deleteClientInvites,
  getWorkspace,
  limitLogin,
  clearAccountAttempts,
  userExistsByClient,
  UserRow,
} from "./db";
import {
  passwordHash,
  passwordMatches,
  tokenHash,
  timingSafeEqual,
  randomHex,
  randomToken,
} from "./crypto";
import { text, email, validateWorkspace } from "./validate";
import {
  authenticate,
  checkOrigin,
  getCookie,
  sessionCookie,
  clearCookie,
  COOKIE,
} from "./guards";

function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, client: u.client };
}

function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") || "unknown";
}

// Constant dummy hash so a missing account costs the same time as a wrong password.
let DUMMY: string | null = null;
async function dummyHash(): Promise<string> {
  if (!DUMMY) DUMMY = await passwordHash(randomToken(24));
  return DUMMY;
}

export async function authStatus(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  const setup = !(await coachExists(env.DB));
  try {
    const user = await authenticate(req, env);
    return json({ authenticated: true, user: publicUser(user), csrf: user.csrf }, 200, {}, origin);
  } catch {
    return json(
      { authenticated: false, setup, setupTokenRequired: !isLocalSetup(req, env) },
      200,
      {},
      origin,
    );
  }
}

export async function authSetup(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  checkOrigin(req, env);
  const body = await readJson(req);
  if (!isLocalSetup(req, env)) {
    if (
      !env.STC_SETUP_TOKEN ||
      !timingSafeEqual(String(body.setupToken ?? ""), env.STC_SETUP_TOKEN)
    ) {
      throw new APIError("Enter the setup code from your hosting settings.", 403);
    }
  }
  const hashed = await passwordHash(body.password);
  const address = email(body.email);
  const name = text(body.name, "coach name", 80);
  const workspace = validateWorkspace(body.workspace);
  workspace.settings.coach = name;
  workspace.settings.email = address;
  if (await coachExists(env.DB)) {
    throw new APIError("This club is already set up. Sign in instead.", 409);
  }
  const uid = randomHex(16);
  await createClub(env.DB, uid, address, hashed, name, JSON.stringify(workspace));
  const { raw } = await createSession(env.DB, uid);
  return json({ ok: true }, 201, { "Set-Cookie": sessionCookie(raw, cookieSecure(req, env)) }, origin);
}

export async function authLogin(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  checkOrigin(req, env);
  const body = await readJson(req);
  const address = email(body.email);
  const pw = text(body.password, "password", 512);
  await limitLogin(env.DB, "ip:" + clientIp(req), "account:" + address);
  const user = await userByEmail(env.DB, address);
  const ok = await passwordMatches(pw, user ? user.password : await dummyHash());
  if (!user || !ok) throw new APIError("Email or password did not match.", 401);
  await clearAccountAttempts(env.DB, "account:" + address);
  const { raw } = await createSession(env.DB, user.id);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(raw, cookieSecure(req, env)) }, origin);
}

export async function authLogout(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  await authenticate(req, env, { write: true });
  const token = getCookie(req, COOKIE);
  if (token) await deleteSession(env.DB, await tokenHash(token));
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie(cookieSecure(req, env)) }, origin);
}

export async function changePassword(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  const user = await authenticate(req, env, { write: true });
  const body = await readJson(req);
  if (!(await passwordMatches(text(body.current, "current password", 512), user.password))) {
    throw new APIError("Your current password did not match.", 403);
  }
  const hashed = await passwordHash(body.password);
  await updatePassword(env.DB, user.id, hashed);
  await deleteOtherSessions(env.DB, user.id, user.csrf!);
  return json({ ok: true }, 200, {}, origin);
}

export async function inviteInfo(req: Request, env: Env, token: string): Promise<Response> {
  const origin = publicOrigin(req, env);
  const row = await inviteClient(env.DB, await tokenHash(token));
  if (!row) {
    throw new APIError(
      "This link has expired or has already been used. Ask your coach for a new one.",
      410,
    );
  }
  const [{ w }, hasAccount] = await Promise.all([
    getWorkspace(env.DB),
    userExistsByClient(env.DB, row.client),
  ]);
  const c = w.clients.find((c: any) => c.id === row.client);
  if (!c) throw new APIError("This invitation is no longer available.", 410);
  return json({ name: c.name, email: c.email, club: w.settings.club, hasAccount }, 200, {}, origin);
}

export async function acceptInvite(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  checkOrigin(req, env);
  const body = await readJson(req);
  const hashed = await passwordHash(body.password);
  const row = await inviteClient(env.DB, await tokenHash(String(body.token ?? "")));
  if (!row) throw new APIError("This invitation has expired or has already been used.", 410);
  const { w } = await getWorkspace(env.DB);
  const c = w.clients.find((c: any) => c.id === row.client);
  if (!c) throw new APIError("This client no longer exists.", 410);
  const existing = await userByEmail(env.DB, c.email.toLowerCase());
  if (existing && (existing.role !== "member" || existing.client !== c.id)) {
    throw new APIError("This email is already used by another account.", 409);
  }
  const uid = existing ? existing.id : randomHex(16);
  if (existing) {
    await updatePassword(env.DB, uid, hashed);
    await deleteUserSessions(env.DB, uid);
  } else {
    await insertUser(env.DB, {
      id: uid,
      email: c.email.toLowerCase(),
      password: hashed,
      role: "member",
      client: c.id,
      name: c.name,
    });
  }
  await deleteClientInvites(env.DB, c.id);
  const { raw } = await createSession(env.DB, uid);
  return json({ ok: true }, 201, { "Set-Cookie": sessionCookie(raw, cookieSecure(req, env)) }, origin);
}
