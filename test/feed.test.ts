import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { createInvite } from "../src/db";
import { weeklyTests } from "../src/tests";
import { today } from "../src/time";
import { req, wipe, cookieFrom, fullWorkspace, memberLogin, setupCoach } from "./helpers";

async function secondMember(client = "c2") {
  const { raw } = await createInvite(env.DB, client);
  const accept = await req("/api/auth/accept", "POST", { token: raw, password: "second member pw 123" });
  const cookie = cookieFrom(accept.setCookie);
  const status = await req("/api/auth/status", "GET", undefined, { cookie });
  return { cookie, csrf: status.json.csrf };
}

beforeEach(wipe);

describe("club feed", () => {
  it("session + test logs create feed cards; same-day session card tops up", async () => {
    await setupCoach(fullWorkspace());
    const m = await memberLogin(); // c1
    await req("/api/member/actions", "POST", { key: "f1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] }, m);
    const t = weeklyTests(today())[0];
    const r = await req("/api/member/actions", "POST", { key: "f2", action: "result", kind: t.kind, value: 30, date: today() }, m);
    const feed = r.json.workspace.feed;
    expect(feed.length).toBe(2);
    expect(feed[0].kind).toBe("test");
    expect(feed[0].name).toContain("Sam");
    expect(feed[1].kind).toBe("session");
    expect(feed[1].detail).toContain("1/1 exercises");
  });

  it("body weight never reaches the feed", async () => {
    await setupCoach(fullWorkspace());
    const m = await memberLogin();
    const r = await req("/api/member/actions", "POST", { key: "bw", action: "result", kind: "Body weight", value: 82.5, date: today() }, m);
    expect(r.json.workspace.feed.length).toBe(0);
  });

  it("feed respects leaderboard consent between members", async () => {
    await setupCoach(fullWorkspace());
    const m1 = await memberLogin(); // c1
    const m2 = await secondMember(); // c2
    // c1 logs a session but has NOT opted in
    await req("/api/member/actions", "POST", { key: "c1s", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] }, m1);
    const seenByM2 = await req("/api/workspace", "GET", undefined, { cookie: m2.cookie });
    expect(seenByM2.json.workspace.feed.length).toBe(0); // hidden from others
    const seenByM1 = await req("/api/workspace", "GET", undefined, { cookie: m1.cookie });
    expect(seenByM1.json.workspace.feed.length).toBe(1); // own post always visible
    // c1 opts in -> post becomes visible to m2
    await req("/api/member/actions", "POST", { key: "c1p", action: "privacy", optIn: true }, m1);
    const after = await req("/api/workspace", "GET", undefined, { cookie: m2.cookie });
    expect(after.json.workspace.feed.length).toBe(1);
  });

  it("kudos toggles on and off", async () => {
    await setupCoach(fullWorkspace());
    const m1 = await memberLogin();
    await req("/api/member/actions", "POST", { key: "k0", action: "privacy", optIn: true }, m1);
    const logged = await req("/api/member/actions", "POST", { key: "k1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] }, m1);
    const id = logged.json.workspace.feed[0].id;
    const m2 = await secondMember();
    const on = await req("/api/member/actions", "POST", { key: "k2", action: "kudos", id }, m2);
    expect(on.json.workspace.feed[0].kudos.length).toBe(1);
    const off = await req("/api/member/actions", "POST", { key: "k3", action: "kudos", id }, m2);
    expect(off.json.workspace.feed[0].kudos.length).toBe(0);
  });

  it("whatsapp link reaches members only when set", async () => {
    const coach = await setupCoach(fullWorkspace());
    const m = await memberLogin();
    let ws = await req("/api/workspace", "GET", undefined, { cookie: m.cookie });
    expect(ws.json.workspace.settings.whatsapp).toBeUndefined();

    const coachWs = await req("/api/workspace", "GET", undefined, { cookie: coach.cookie });
    const w = coachWs.json.workspace;
    w.settings.whatsapp = "https://chat.whatsapp.com/abc123";
    const put = await req("/api/workspace", "PUT", { workspace: w, revision: coachWs.json.revision }, coach);
    expect(put.status).toBe(200);
    ws = await req("/api/workspace", "GET", undefined, { cookie: m.cookie });
    expect(ws.json.workspace.settings.whatsapp).toBe("https://chat.whatsapp.com/abc123");
  });
});
