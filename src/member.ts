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
import { MEASURE_KINDS, testByKind } from "./tests";
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

// Club feed: one card per session per day (topped up as the session merges),
// plus a card per club-test result. Visibility is filtered per-member in
// viewFor by leaderboard consent.
function upsertSessionFeed(w: any, cid: string, p: any, log: any): void {
  w.feed = Array.isArray(w.feed) ? w.feed : [];
  const xp = Math.round(50 * ((log.completedCount ?? 1) / (log.exerciseCount || 1)));
  const detail = `${log.completedCount}/${log.exerciseCount} exercises · ${xp} XP`;
  const existing = w.feed.find(
    (f: any) => f.kind === "session" && f.client === cid && f.date === today() && f.ref === p.id,
  );
  if (existing) existing.detail = detail;
  else
    w.feed.unshift({
      id: randomHex(12),
      kind: "session",
      client: cid,
      date: today(),
      ref: p.id,
      title: p.name,
      detail,
      kudos: [],
    });
  w.feed = w.feed.slice(0, 200);
}

function pushTestFeed(w: any, cid: string, kind: string, value: number): void {
  w.feed = Array.isArray(w.feed) ? w.feed : [];
  w.feed.unshift({
    id: randomHex(12),
    kind: "test",
    client: cid,
    date: today(),
    title: kind,
    value,
    kudos: [],
  });
  w.feed = w.feed.slice(0, 200);
}
function applyMemberAction(w: any, user: UserRow, body: any): void {
  const cid = user.client as string; // members always have a client (guarded below)
  const c = w.clients.find((c: any) => c.id === cid);
  if (!c) throw new APIError("This account is no longer available.", 403);
  const action = body.action;
  const recordId = randomHex(16);

  if (action === "workout") {
    const p = w.programmes.find((p: any) => p.id === c.programme);
    if (!p) throw new APIError("Your coach has not assigned a programme yet.", 409);
    // A client may log a partial session — any non-empty subset of the
    // programme's exercises (people don't always have time for all of them).
    const completed = body.completed ?? [];
    const progIds = new Set<string>(p.exercises.map((e: any) => e.id));
    if (
      !Array.isArray(completed) ||
      completed.length < 1 ||
      new Set(completed).size !== completed.length ||
      !completed.every((id: string) => progIds.has(id))
    ) {
      throw new APIError("Mark at least one exercise complete to log this session.");
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
    // Same day + same programme = ONE session. Logging again later in the day
    // tops up the existing log instead of counting a second session.
    const existing = w.logs.find(
      (l: any) => l.client === cid && l.date === today() && l.programme === p.id,
    );
    if (existing) {
      const entryList: any[] = Array.isArray(existing.entries) ? existing.entries : [];
      for (const entry of entries) {
        const i = entryList.findIndex((e: any) => e.exercise === entry.exercise);
        if (i >= 0) entryList[i] = entry; // repeat of an exercise: latest result wins
        else entryList.push(entry);
      }
      existing.entries = entryList;
      const done = new Set<string>(entryList.map((e: any) => e.exercise));
      for (const id of completed) done.add(id);
      existing.completedCount = done.size;
      existing.exerciseCount = p.exercises.length;
      upsertSessionFeed(w, cid, p, existing);
    } else {
      w.logs.push({
        id: recordId,
        client: cid,
        date: today(),
        type: "Programme session",
        programme: p.id,
        entries,
        // Partial sessions earn proportional club points (legacy logs = full).
        completedCount: completed.length,
        exerciseCount: p.exercises.length,
      });
      w.activity.unshift({
        id: randomHex(16),
        title: firstName(c.name) + " completed a session",
        text: p.name + " · Another step forward.",
        date: today(),
        icon: "checkCircle",
        tone: "green",
      });
      upsertSessionFeed(w, cid, p, w.logs[w.logs.length - 1]);
    }
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
    if (!MEASURE_KINDS.has(kind)) {
      throw new APIError("Choose a valid measurement.");
    }
    const value = number(body.value, "result", 0.1, 10000);
    const def = testByKind(kind);
    if (def?.int && value !== Math.trunc(value)) {
      throw new APIError("Use whole numbers for this test.");
    }
    w.measures.push({ id: recordId, client: cid, kind, value, date: date(body.date, false) });
    // Club tests go to the feed; Body weight stays private.
    if (kind !== "Body weight") pushTestFeed(w, cid, kind, value);
  } else if (action === "kudos") {
    const item = (Array.isArray(w.feed) ? w.feed : []).find((f: any) => f.id === body.id);
    if (!item) throw new APIError("That post is no longer on the feed.");
    item.kudos = Array.isArray(item.kudos) ? item.kudos : [];
    const i = item.kudos.indexOf(cid);
    if (i >= 0) item.kudos.splice(i, 1);
    else item.kudos.push(cid);
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
