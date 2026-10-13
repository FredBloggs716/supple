import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createInvite } from "../src/db";
import { req, wipe, fullWorkspace, memberLogin, setupCoach, cookieFrom } from "./helpers";
import { today } from "../src/time";

function wsWithSession(): any {
  const ws = fullWorkspace();
  ws.sessions = [
    { id: "s1", name: "Group", date: today(), time: "09:00", clients: ["c1", "c2"], duration: 60, attended: [] },
    { id: "s2", name: "Solo", date: today(), time: "10:00", clients: ["c1"], duration: 45, attended: [] },
  ];
  return ws;
}

beforeEach(wipe);

describe("client access — revoke (pause)", () => {
  it("locks the member out immediately and cancels invites", async () => {
    const coach = await setupCoach(fullWorkspace());
    const member = await memberLogin(); // c1 account + live session
    const { raw } = await createInvite(env.DB, "c1"); // a pending invite too

    const r = await req("/api/clients/c1/access", "POST", { action: "revoke" }, coach);
    expect(r.status).toBe(200);
    expect(r.json.hadAccount).toBe(true);

    // member session dead, password gone
    expect((await req("/api/workspace", "GET", undefined, { cookie: member.cookie })).status).toBe(401);
    const login = await req("/api/auth/login", "POST", { email: "member@x.com", password: "member password 12345" });
    expect(login.status).toBe(401);
    // pending invite cancelled
    expect((await req("/api/invitations/" + raw)).status).toBe(410);
    // client record preserved
    const view = await req("/api/workspace", "GET", undefined, { cookie: coach.cookie });
    expect(view.json.workspace.clients.some((c: any) => c.id === "c1")).toBe(true);
  });

  it("a new invitation restores access after a revoke", async () => {
    const coach = await setupCoach(fullWorkspace());
    await memberLogin();
    await req("/api/clients/c1/access", "POST", { action: "revoke" }, coach);

    const inv = await req("/api/invitations", "POST", { client: "c1" }, coach);
    expect(inv.status).toBe(201);
    const accept = await req("/api/auth/accept", "POST", { token: inv.json.token, password: "back in the club 123" });
    expect(accept.status).toBe(201);
    const status = await req("/api/auth/status", "GET", undefined, { cookie: cookieFrom(accept.setCookie) });
    expect(status.json.user.client).toBe("c1");
  });
});

describe("client access — delete", () => {
  it("removes the client, their records and their session membership", async () => {
    const coach = await setupCoach(wsWithSession());
    const member = await memberLogin();
    // give c1 a log via the member API
    await req(
      "/api/member/actions",
      "POST",
      { key: "k1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] },
      member,
    );

    const r = await req("/api/clients/c1/access", "POST", { action: "delete" }, coach);
    expect(r.status).toBe(200);
    const w = r.json.workspace;
    expect(w.clients.some((c: any) => c.id === "c1")).toBe(false);
    expect(w.logs.some((l: any) => l.client === "c1")).toBe(false);
    // group session keeps c2; c1-only session is dropped
    expect(w.sessions.length).toBe(1);
    expect(w.sessions[0].clients).toEqual(["c2"]);
    // member locked out
    expect((await req("/api/workspace", "GET", undefined, { cookie: member.cookie })).status).toBe(401);
  });
});

describe("client access — guards", () => {
  it("rejects members, unknown clients and unknown actions", async () => {
    const coach = await setupCoach(fullWorkspace());
    const member = await memberLogin();
    expect((await req("/api/clients/c2/access", "POST", { action: "revoke" }, member)).status).toBe(403);
    expect((await req("/api/clients/ghost/access", "POST", { action: "revoke" }, coach)).status).toBe(404);
    expect((await req("/api/clients/c2/access", "POST", { action: "explode" }, coach)).status).toBe(400);
  });
});
