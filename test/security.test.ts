import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createInvite } from "../src/db";
import { req, wipe, cookieFrom, baseWorkspace, fullWorkspace, sampleClient, setupCoach, memberLogin } from "./helpers";

beforeEach(wipe);

describe("origin / CSRF guards", () => {
  it("rejects a write from a cross-origin Origin header", async () => {
    const r = await req(
      "/api/auth/setup",
      "POST",
      { name: "C", email: "c@x.com", password: "coach password 12345", workspace: baseWorkspace(), setupToken: "test-setup-token" },
      { headers: { Origin: "https://evil.example" } },
    );
    expect(r.status).toBe(403);
  });

  it("rejects a write flagged Sec-Fetch-Site: cross-site", async () => {
    const r = await req(
      "/api/auth/setup",
      "POST",
      { name: "C", email: "c@x.com", password: "coach password 12345", workspace: baseWorkspace(), setupToken: "test-setup-token" },
      { headers: { "Sec-Fetch-Site": "cross-site" } },
    );
    expect(r.status).toBe(403);
  });

  it("rejects a workspace PUT with a wrong CSRF token", async () => {
    const { cookie } = await setupCoach(fullWorkspace());
    const r = await req("/api/workspace", "PUT", { workspace: fullWorkspace(), revision: 1 }, { cookie, csrf: "wrong-token" });
    expect(r.status).toBe(403);
  });
});

describe("authentication boundaries", () => {
  it("401s protected reads without a cookie", async () => {
    await setupCoach();
    expect((await req("/api/workspace")).status).toBe(401);
    expect((await req("/api/leaderboard")).status).toBe(401);
  });

  it("stops a member using coach-only endpoints", async () => {
    await setupCoach(fullWorkspace());
    const m = await memberLogin();
    expect((await req("/api/invitations", "POST", { client: "c1" }, m)).status).toBe(403);
    expect((await req("/api/workspace", "PUT", { workspace: fullWorkspace(), revision: 1 }, m)).status).toBe(403);
  });

  it("logout invalidates the session", async () => {
    const { cookie, csrf } = await setupCoach();
    await req("/api/auth/logout", "POST", {}, { cookie, csrf });
    expect((await req("/api/workspace", "GET", undefined, { cookie })).status).toBe(401);
  });
});

describe("invitation & password session hygiene", () => {
  it("accepting a fresh invite resets the member and kills old sessions", async () => {
    const ws = baseWorkspace();
    ws.clients = [sampleClient("c1", "member@x.com")];
    await setupCoach(ws);
    const first = await memberLogin(); // sets a password, holds cookie
    expect((await req("/api/auth/status", "GET", undefined, { cookie: first.cookie })).json.authenticated).toBe(true);

    const { raw } = await createInvite(env.DB, "c1");
    const accept = await req("/api/auth/accept", "POST", { token: raw, password: "a new member password 1" });
    expect(accept.status).toBe(201);
    // old session is now dead
    expect((await req("/api/auth/status", "GET", undefined, { cookie: first.cookie })).json.authenticated).toBe(false);
  });

  it("password change keeps the current session but drops the others", async () => {
    const a = await setupCoach(); // session A (+ its csrf)
    const loginB = await req("/api/auth/login", "POST", { email: "coach@x.com", password: "coach password 12345" });
    const cookieB = cookieFrom(loginB.setCookie);

    const change = await req("/api/password", "POST", { current: "coach password 12345", password: "brand new password 9" }, { cookie: a.cookie, csrf: a.csrf });
    expect(change.status).toBe(200);
    expect((await req("/api/auth/status", "GET", undefined, { cookie: a.cookie })).json.authenticated).toBe(true);
    expect((await req("/api/auth/status", "GET", undefined, { cookie: cookieB })).json.authenticated).toBe(false);
  });

  it("a successful login clears the account's failed-attempt counter", async () => {
    await setupCoach();
    for (let i = 0; i < 9; i++) {
      expect((await req("/api/auth/login", "POST", { email: "coach@x.com", password: "wrong wrong wrong" })).status).toBe(401);
    }
    expect((await req("/api/auth/login", "POST", { email: "coach@x.com", password: "coach password 12345" })).status).toBe(200);
    // counter reset — the next bad attempt is 401, not 429
    expect((await req("/api/auth/login", "POST", { email: "coach@x.com", password: "wrong again here" })).status).toBe(401);
  });
});
