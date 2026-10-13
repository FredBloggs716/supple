// Coach client-access management: revoke sign-in access (pause) or delete a
// client entirely. Revoking deletes the member account, their sessions, pending
// invitations and idempotency events — records stay, and a new invitation
// restores access. Deleting also removes the client and all their records from
// the workspace (sessions they were in lose them; empty sessions are dropped).
import { APIError, json, readJson } from "./http";
import { Env, publicOrigin } from "./env";
import { getWorkspace, putWorkspace, UserRow } from "./db";
import { validateWorkspace } from "./validate";
import { viewFor } from "./analytics";

async function revokeAccess(db: D1Database, cid: string): Promise<boolean> {
  const member = await db
    .prepare("SELECT id FROM users WHERE role='member' AND client=?")
    .bind(cid)
    .first<{ id: string }>();
  const stmts = [db.prepare("DELETE FROM invitations WHERE client=?").bind(cid)];
  if (member) {
    stmts.push(db.prepare("DELETE FROM sessions WHERE user=?").bind(member.id));
    stmts.push(db.prepare("DELETE FROM events WHERE user=?").bind(member.id));
    stmts.push(db.prepare("DELETE FROM users WHERE id=?").bind(member.id));
  }
  await db.batch(stmts);
  return !!member;
}

export async function clientAccess(
  req: Request,
  env: Env,
  user: UserRow,
  cid: string,
): Promise<Response> {
  const origin = publicOrigin(req, env);
  if (user.role !== "coach") throw new APIError("Only your coach can manage client access.", 403);
  const body = await readJson(req);
  const { w, revision } = await getWorkspace(env.DB);
  const c = w.clients.find((c: any) => c.id === cid);
  if (!c) throw new APIError("Choose a valid client.", 404);

  if (body.action === "revoke") {
    const had = await revokeAccess(env.DB, cid);
    return json({ ok: true, hadAccount: had, workspace: viewFor(user, w), revision }, 200, {}, origin);
  }

  if (body.action === "delete") {
    await revokeAccess(env.DB, cid);
    w.clients = w.clients.filter((x: any) => x.id !== cid);
    for (const k of ["logs", "measures", "meals"]) {
      w[k] = w[k].filter((r: any) => r.client !== cid);
    }
    w.water = Object.fromEntries(
      Object.entries(w.water).filter(([k]) => !k.startsWith(cid + "-")),
    );
    w.sessions = w.sessions
      .map((s: any) => ({
        ...s,
        clients: s.clients.filter((x: string) => x !== cid),
        attended: (s.attended || []).filter((x: string) => x !== cid),
      }))
      .filter((s: any) => s.clients.length > 0);
    validateWorkspace(w);
    const newRevision = await putWorkspace(env.DB, JSON.stringify(w), revision);
    if (newRevision === null) throw new APIError("Another update arrived. Please try again.", 409);
    return json({ ok: true, workspace: viewFor(user, w), revision: newRevision }, 200, {}, origin);
  }

  throw new APIError("Unknown access action.");
}
