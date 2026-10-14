import { describe, it, expect, beforeEach } from "vitest";
import { req, wipe, cookieFrom, fullWorkspace, setupCoach } from "./helpers";

const NO = [false, false, false, false, false, false, false];

function body(over: any = {}) {
  return {
    name: "New Joiner",
    email: "joiner@x.com",
    password: "a brand new member pw 1",
    parq: NO,
    consent: true,
    ...over,
  };
}

beforeEach(wipe);

describe("self-serve signup", () => {
  it("creates a member with PAR-Q + consent and signs them in", async () => {
    const coach = await setupCoach(fullWorkspace());
    const r = await req("/api/auth/signup", "POST", body());
    expect(r.status).toBe(201);
    expect(r.json.flagged).toBe(false);
    expect(r.setCookie).toContain("stc_session=");

    // new member can use the app immediately
    const cookie = cookieFrom(r.setCookie);
    const ws = await req("/api/workspace", "GET", undefined, { cookie });
    expect(ws.status).toBe(200);
    expect(ws.json.workspace.clients[0].name).toBe("New Joiner");

    // coach sees the client with PAR-Q, consent and self-signup marker
    const coachView = await req("/api/workspace", "GET", undefined, { cookie: coach.cookie });
    const c = coachView.json.workspace.clients.find((c: any) => c.email === "joiner@x.com");
    expect(c.parq.flagged).toBe(false);
    expect(c.parq.answers.length).toBe(7);
    expect(c.consent.acceptedAt).toBeTruthy();
    expect(c.source).toBe("self");
    // activity entry announces the join
    expect(coachView.json.workspace.activity.some((a: any) => a.title.includes("joined the club"))).toBe(true);
  });

  it("flags a YES answer for coach review", async () => {
    await setupCoach(fullWorkspace());
    const r = await req("/api/auth/signup", "POST", body({ parq: [false, true, false, false, false, false, false], email: "flagged@x.com" }));
    expect(r.status).toBe(201);
    expect(r.json.flagged).toBe(true);
  });

  it("rejects missing/invalid PAR-Q and missing consent", async () => {
    await setupCoach(fullWorkspace());
    expect((await req("/api/auth/signup", "POST", body({ parq: undefined }))).status).toBe(400);
    expect((await req("/api/auth/signup", "POST", body({ parq: [true, false] }))).status).toBe(400);
    expect((await req("/api/auth/signup", "POST", body({ parq: ["yes", "no", "no", "no", "no", "no", "no"] }))).status).toBe(400);
    expect((await req("/api/auth/signup", "POST", body({ consent: false }))).status).toBe(400);
  });

  it("rejects duplicate emails (existing client or account)", async () => {
    await setupCoach(fullWorkspace()); // has client member@x.com
    expect((await req("/api/auth/signup", "POST", body({ email: "member@x.com" }))).status).toBe(409);
    await req("/api/auth/signup", "POST", body());
    expect((await req("/api/auth/signup", "POST", body())).status).toBe(409);
  });

  it("enforces password rules and origin checks", async () => {
    await setupCoach(fullWorkspace());
    expect((await req("/api/auth/signup", "POST", body({ password: "short" }))).status).toBe(400);
    expect(
      (await req("/api/auth/signup", "POST", body({ email: "x@y.co" }), { headers: { Origin: "https://evil.example" } })).status,
    ).toBe(403);
  });
});
