import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createInvite } from "../src/db";
import { req, wipe, cookieFrom, baseWorkspace, sampleClient, setupCoach } from "./helpers";

function fullWorkspace(): any {
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
    { id: "l1", client: "c1", date: "2020-01-01", type: "Programme session", programme: "p1", entries: [] },
    { id: "l2", client: "c2", date: "2020-01-01", type: "Programme session", programme: "p1", entries: [] },
  ];
  ws.meals = [
    { id: "ml1", client: "c2", date: "2020-01-01", name: "Lunch", calories: 500, protein: 30, carbs: 50, fat: 10 },
  ];
  ws.measures = [
    { id: "ms1", client: "c2", date: "2020-01-01", kind: "Deadlift", value: 180 },
  ];
  ws.activity = [
    { id: "a1", title: "c2 completed a session", text: "x", date: "2020-01-01", icon: "checkCircle", tone: "green" },
  ];
  return ws;
}

async function memberLogin(): Promise<{ cookie: string; csrf: string }> {
  const { raw } = await createInvite(env.DB, "c1");
  const accept = await req("/api/auth/accept", "POST", { token: raw, password: "member password 12345" });
  const cookie = cookieFrom(accept.setCookie);
  const status = await req("/api/auth/status", "GET", undefined, { cookie });
  return { cookie, csrf: status.json.csrf };
}

beforeEach(wipe);

describe("workspace read", () => {
  it("gives the coach the full workspace including notes", async () => {
    const { cookie } = await setupCoach(fullWorkspace());
    const r = await req("/api/workspace", "GET", undefined, { cookie });
    expect(r.status).toBe(200);
    expect(r.json.workspace.clients.length).toBe(2);
    expect(r.json.workspace.clients[0].notes.length).toBe(1);
    expect(r.json.workspace.logs.length).toBe(2);
  });

  it("isolates a member to only their own data", async () => {
    await setupCoach(fullWorkspace());
    const { cookie } = await memberLogin();
    const r = await req("/api/workspace", "GET", undefined, { cookie });
    expect(r.status).toBe(200);
    const w = r.json.workspace;
    // only own client, notes stripped
    expect(w.clients.length).toBe(1);
    expect(w.clients[0].id).toBe("c1");
    expect(w.clients[0].notes).toEqual([]);
    // only own logs; nothing belonging to c2
    expect(w.logs.every((l: any) => l.client === "c1")).toBe(true);
    expect(w.logs.some((l: any) => l.client === "c2")).toBe(false);
    // other clients' meals/measures are invisible
    expect(w.meals.length).toBe(0);
    expect(w.measures.length).toBe(0);
    // activity feed and coach email are not exposed
    expect(w.activity).toEqual([]);
    expect(w.settings.email).toBeUndefined();
  });
});

describe("workspace write", () => {
  it("lets the coach save and bumps the revision", async () => {
    const { cookie, csrf } = await setupCoach(fullWorkspace());
    const ws = fullWorkspace();
    ws.clients[0].name = "Sam Updated";
    const r = await req("/api/workspace", "PUT", { workspace: ws, revision: 1 }, { cookie, csrf });
    expect(r.status).toBe(200);
    expect(r.json.revision).toBe(2);
  });

  it("rejects a stale revision", async () => {
    const { cookie, csrf } = await setupCoach(fullWorkspace());
    const r = await req("/api/workspace", "PUT", { workspace: fullWorkspace(), revision: 999 }, { cookie, csrf });
    expect(r.status).toBe(409);
  });

  it("forbids a member from writing", async () => {
    await setupCoach(fullWorkspace());
    const { cookie, csrf } = await memberLogin();
    const r = await req("/api/workspace", "PUT", { workspace: fullWorkspace(), revision: 1 }, { cookie, csrf });
    expect(r.status).toBe(403);
  });

  it("refuses to change a linked client's email", async () => {
    const { cookie, csrf } = await setupCoach(fullWorkspace());
    await memberLogin(); // c1 now has a member account tied to member@x.com
    const ws = fullWorkspace();
    ws.clients[0].email = "changed@x.com";
    const r = await req("/api/workspace", "PUT", { workspace: ws, revision: 1 }, { cookie, csrf });
    expect(r.status).toBe(409);
  });
});
