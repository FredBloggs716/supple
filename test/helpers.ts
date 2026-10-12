import { SELF, env } from "cloudflare:test";
import { createInvite } from "../src/db";

export const BASE = "https://example.com";

export interface Res {
  status: number;
  json: any;
  setCookie: string | null;
}

export async function req(
  path: string,
  method = "GET",
  body?: unknown,
  opts: {
    cookie?: string;
    csrf?: string;
    raw?: BodyInit;
    contentType?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  if (opts.csrf) headers["X-CSRF-Token"] = opts.csrf;
  Object.assign(headers, opts.headers || {});
  const res = await SELF.fetch(BASE + path, {
    method,
    headers,
    body: opts.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let j: any = null;
  try {
    j = await res.json();
  } catch {
    /* non-JSON (e.g. video) */
  }
  return { status: res.status, json: j, setCookie: res.headers.get("Set-Cookie") };
}

export function cookieFrom(setCookie: string | null): string {
  return (setCookie ?? "").split(";")[0];
}

export async function wipe(): Promise<void> {
  for (const t of ["users", "sessions", "workspace", "invitations", "videos", "events", "attempts"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
}

export function baseWorkspace(): any {
  return {
    version: 1,
    settings: { coach: "Coach", club: "Club", email: "coach@example.com" },
    water: {},
    clients: [],
    programmes: [],
    exercises: [],
    logs: [],
    measures: [],
    sessions: [],
    meals: [],
    activity: [],
  };
}

export function sampleClient(id: string, email: string, programme = ""): any {
  return {
    id,
    name: "Sam Jones",
    email,
    colour: "blue",
    programme,
    notes: [],
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
  };
}

// A populated workspace: 1 exercise, 1 programme, 2 clients (c1 with a coach
// note + programme p1, c2 with its own meals/measures/activity).
export function fullWorkspace(): any {
  const ws = baseWorkspace();
  ws.exercises = [
    { id: "e1", name: "Squat", equipment: "Barbell", prescription: "3x5", cues: ["brace"] },
  ];
  ws.programmes = [
    {
      id: "p1",
      name: "Strength",
      description: "Base strength block",
      weeks: 4,
      frequency: 3,
      colour: "",
      exercises: [{ id: "e1", sets: "3x5" }],
    },
  ];
  const c1 = sampleClient("c1", "member@x.com", "p1");
  c1.notes = [{ text: "private coach note about c1", date: "2020-01-02" }];
  const c2 = sampleClient("c2", "other@x.com", "p1");
  ws.clients = [c1, c2];
  ws.logs = [
    { id: "l2", client: "c2", date: "2020-01-01", type: "Programme session", programme: "p1", entries: [] },
  ];
  ws.meals = [
    { id: "ml1", client: "c2", date: "2020-01-01", name: "Lunch", calories: 500, protein: 30, carbs: 50, fat: 10 },
  ];
  ws.measures = [{ id: "ms1", client: "c2", date: "2020-01-01", kind: "Deadlift", value: 180 }];
  return ws;
}

// Accept an invite for a client id and return that member's cookie + csrf.
export async function memberLogin(client = "c1"): Promise<{ cookie: string; csrf: string }> {
  const { raw } = await createInvite(env.DB, client);
  const accept = await req("/api/auth/accept", "POST", { token: raw, password: "member password 12345" });
  const cookie = cookieFrom(accept.setCookie);
  const status = await req("/api/auth/status", "GET", undefined, { cookie });
  return { cookie, csrf: status.json.csrf };
}

// Create the coach account; returns the session cookie + csrf for authed calls.
export async function setupCoach(ws: any = baseWorkspace()): Promise<{ cookie: string; csrf: string }> {
  const r = await req("/api/auth/setup", "POST", {
    name: "Coach",
    email: "coach@x.com",
    password: "coach password 12345",
    workspace: ws,
    setupToken: "test-setup-token",
  });
  if (r.status !== 201) throw new Error("setup failed: " + JSON.stringify(r.json));
  const cookie = cookieFrom(r.setCookie);
  const status = await req("/api/auth/status", "GET", undefined, { cookie });
  return { cookie, csrf: status.json.csrf };
}
