import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createInvite } from "../src/db";
import { req, wipe, cookieFrom, baseWorkspace, sampleClient, setupCoach } from "./helpers";

beforeEach(wipe);

describe("setup", () => {
  it("requires the setup token when hosted, then creates the coach once", async () => {
    const noToken = await req("/api/auth/setup", "POST", {
      name: "Coach",
      email: "coach@x.com",
      password: "coach password 12345",
      workspace: baseWorkspace(),
    });
    expect(noToken.status).toBe(403);

    const ok = await req("/api/auth/setup", "POST", {
      name: "Coach",
      email: "coach@x.com",
      password: "coach password 12345",
      workspace: baseWorkspace(),
      setupToken: "test-setup-token",
    });
    expect(ok.status).toBe(201);
    expect(ok.setCookie).toContain("stc_session=");
    expect(ok.setCookie).toContain("HttpOnly");

    const second = await req("/api/auth/setup", "POST", {
      name: "Coach",
      email: "coach@x.com",
      password: "coach password 12345",
      workspace: baseWorkspace(),
      setupToken: "test-setup-token",
    });
    expect(second.status).toBe(409);
  });
});

describe("status", () => {
  it("reports setup state and auth", async () => {
    const before = await req("/api/auth/status");
    expect(before.json).toMatchObject({ authenticated: false, setup: true, setupTokenRequired: true });

    const { cookie } = await setupCoach();
    const authed = await req("/api/auth/status", "GET", undefined, { cookie });
    expect(authed.json.authenticated).toBe(true);
    expect(authed.json.user.role).toBe("coach");
    expect(typeof authed.json.csrf).toBe("string");

    const anon = await req("/api/auth/status");
    expect(anon.json).toMatchObject({ authenticated: false, setup: false });
  });
});

describe("login / logout", () => {
  it("rejects wrong credentials and accepts correct ones", async () => {
    await setupCoach();
    const bad = await req("/api/auth/login", "POST", { email: "coach@x.com", password: "wrong password!!" });
    expect(bad.status).toBe(401);
    const good = await req("/api/auth/login", "POST", { email: "coach@x.com", password: "coach password 12345" });
    expect(good.status).toBe(200);
    expect(good.setCookie).toContain("stc_session=");
  });

  it("rate-limits after 10 failed attempts", async () => {
    await setupCoach();
    for (let i = 0; i < 10; i++) {
      const r = await req("/api/auth/login", "POST", { email: "coach@x.com", password: "nope nope nope" });
      expect(r.status).toBe(401);
    }
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM attempts WHERE scope=?",
    ).bind("account:coach@x.com").first<{ n: number }>();
    expect(count?.n).toBe(10);
    const blocked = await req("/api/auth/login", "POST", { email: "coach@x.com", password: "coach password 12345" });
    expect(blocked.status).toBe(429);
  });

  it("logout ends the session", async () => {
    const { cookie, csrf } = await setupCoach();
    const out = await req("/api/auth/logout", "POST", {}, { cookie, csrf });
    expect(out.status).toBe(200);
    const after = await req("/api/auth/status", "GET", undefined, { cookie });
    expect(after.json.authenticated).toBe(false);
  });
});

describe("CSRF", () => {
  it("rejects a write without the CSRF header", async () => {
    const { cookie } = await setupCoach();
    const noCsrf = await req("/api/password", "POST", { current: "x", password: "y" }, { cookie });
    expect(noCsrf.status).toBe(403);
  });
});

describe("invitations", () => {
  it("accepts an invite once and sets a member password", async () => {
    const ws = baseWorkspace();
    ws.clients = [sampleClient("c1", "member@x.com")];
    await setupCoach(ws);
    const { raw } = await createInvite(env.DB, "c1");

    const info = await req("/api/invitations/" + raw);
    expect(info.status).toBe(200);
    expect(info.json.email).toBe("member@x.com");

    const accept = await req("/api/auth/accept", "POST", { token: raw, password: "member password 12345" });
    expect(accept.status).toBe(201);
    expect(accept.setCookie).toContain("stc_session=");

    const memberCookie = cookieFrom(accept.setCookie);
    const status = await req("/api/auth/status", "GET", undefined, { cookie: memberCookie });
    expect(status.json.user.role).toBe("member");
    expect(status.json.user.client).toBe("c1");

    const reuse = await req("/api/auth/accept", "POST", { token: raw, password: "another password 12345" });
    expect(reuse.status).toBe(410);
  });
});
