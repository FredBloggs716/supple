import { SELF, env } from "cloudflare:test";

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
  opts: { cookie?: string; csrf?: string; raw?: BodyInit; contentType?: string } = {},
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  if (opts.csrf) headers["X-CSRF-Token"] = opts.csrf;
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
