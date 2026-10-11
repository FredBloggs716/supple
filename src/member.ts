// Coach invitations + member self-service actions. Ports server.py:710-752 and
// member_action (802-904).
import { APIError, json, readJson } from "./http";
import { Env, publicOrigin } from "./env";
import {
  getWorkspace,
  putWorkspace,
  createInvite,
  eventExists,
  insertEvent,
  UserRow,
} from "./db";
import { text, number, date, validateWorkspace } from "./validate";
import { viewFor } from "./analytics";
import { today } from "./time";
import { randomHex } from "./crypto";

export async function createInvitation(req: Request, env: Env, user: UserRow): Promise<Response> {
  const origin = publicOrigin(req, env);
  if (user.role !== "coach") throw new APIError("Only your coach can create invitations.", 403);
  const body = await readJson(req);
  const { w } = await getWorkspace(env.DB);
  const c = w.clients.find((c: any) => c.id === body.client);
  if (!c) throw new APIError("Choose a valid client.");
  const { raw, expires } = await createInvite(env.DB, c.id);
  return json({ token: raw, expires }, 201, {}, origin);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function applyMemberAction(w: any, user: UserRow, body: any): void {
  const cid = user.client;
  const c = w.clients.find((c: any) => c.id === cid);
  if (!c) throw new APIError("This account is no longer available.", 403);
  const action = body.action;
  const recordId = randomHex(16);

  if (action === "workout") {
    const p = w.programmes.find((p: any) => p.id === c.programme);
    if (!p) throw new APIError("Your coach has not assigned a programme yet.", 409);
    const completed = body.completed ?? [];
    if (
      !Array.isArray(completed) ||
      !setsEqual(new Set<string>(completed), new Set<string>(p.exercises.map((e: any) => e.id)))
    ) {
      throw new APIError("Mark every exercise complete before logging this session.");
    }
    const entries = body.entries ?? [];
    if (!Array.isArray(entries) || entries.length > 100) throw new APIError("Invalid training log.");
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || !completed.includes(entry.exercise)) {
        throw new APIError("Invalid exercise in training log.");
      }
      number(entry.weight, "working load", 0, 1000);
      number(entry.reps, "reps", 1, 1000);
    }
    w.logs.push({
      id: recordId,
      client: cid,
      date: today(),
      type: "Programme session",
      programme: p.id,
      entries,
    });
    w.activity.unshift({
      id: randomHex(16),
      title: firstName(c.name) + " completed a session",
      text: p.name + " · Another step forward.",
      date: today(),
      icon: "checkCircle",
      tone: "green",
    });
  } else if (action === "meal") {
    const meal: any = {
      id: recordId,
      client: cid,
      date: today(),
      name: text(body.name, "meal name", 120),
      type: text(body.type, "meal type", 30),
    };
    for (const k of ["calories", "protein", "carbs", "fat"]) meal[k] = number(body[k], k);
    w.meals.push(meal);
  } else if (action === "water") {
    const key = cid + "-" + today();
    w.water[key] = Math.min(200, (w.water[key] || 0) + 1);
  } else if (action === "result") {
    const kind = body.kind;
    if (!["Deadlift", "Body weight", "2 km row"].includes(kind)) {
      throw new APIError("Choose a valid measurement.");
    }
    const value = number(body.value, "result", 0.1, 10000);
    if (kind === "2 km row" && value !== Math.trunc(value)) {
      throw new APIError("Use whole seconds for your rowing time.");
    }
    w.measures.push({ id: recordId, client: cid, kind, value, date: date(body.date, false) });
  } else if (action === "checkin") {
    c.checkin = text(body.text, "check-in", 2000);
    c.status = "Needs attention";
    w.activity.unshift({
      id: recordId,
      title: firstName(c.name) + " checked in",
      text: "A few words for their coach.",
      date: today(),
      icon: "message",
      tone: "",
    });
  } else if (action === "privacy") {
    if (typeof body.optIn !== "boolean") throw new APIError("Choose a valid privacy preference.");
    c.leaderboardOptIn = body.optIn;
  } else {
    throw new APIError("Unknown client action.");
  }
  w.activity = w.activity.slice(0, 30);
}

export async function memberActions(req: Request, env: Env, user: UserRow): Promise<Response> {
  const origin = publicOrigin(req, env);
  if (user.role !== "member") throw new APIError("Sign in as a member to use this action.", 403);
  const body = await readJson(req);
  const key = text(body.key, "action ID", 100);
  const { w, revision } = await getWorkspace(env.DB);

  // Idempotent: a replayed action key returns current state without re-applying.
  if (await eventExists(env.DB, user.id, key)) {
    return json({ workspace: viewFor(user, w), revision }, 200, {}, origin);
  }
  applyMemberAction(w, user, body);
  validateWorkspace(w);
  const newRevision = await putWorkspace(env.DB, JSON.stringify(w), revision);
  if (newRevision === null) {
    throw new APIError("Another update arrived. Please try again.", 409);
  }
  await insertEvent(env.DB, user.id, key);
  return json({ workspace: viewFor(user, w), revision: newRevision }, 200, {}, origin);
}
