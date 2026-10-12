import { describe, it, expect, beforeEach } from "vitest";
import { req, wipe, fullWorkspace, memberLogin, setupCoach } from "./helpers";

beforeEach(wipe);

describe("invitations endpoint", () => {
  it("lets the coach mint an invite token for a valid client", async () => {
    const { cookie, csrf } = await setupCoach(fullWorkspace());
    const r = await req("/api/invitations", "POST", { client: "c1" }, { cookie, csrf });
    expect(r.status).toBe(201);
    expect(typeof r.json.token).toBe("string");
    const bad = await req("/api/invitations", "POST", { client: "nope" }, { cookie, csrf });
    expect(bad.status).toBe(400);
  });
});

describe("member actions", () => {
  it("logs a workout and is idempotent on replay", async () => {
    await setupCoach(fullWorkspace());
    const { cookie, csrf } = await memberLogin();
    const action = {
      key: "evt-1",
      action: "workout",
      completed: ["e1"],
      entries: [{ exercise: "e1", weight: 100, reps: 5 }],
    };
    const first = await req("/api/member/actions", "POST", action, { cookie, csrf });
    expect(first.status).toBe(200);
    expect(first.json.workspace.logs.length).toBe(1);
    const rev = first.json.revision;

    const replay = await req("/api/member/actions", "POST", action, { cookie, csrf });
    expect(replay.status).toBe(200);
    expect(replay.json.workspace.logs.length).toBe(1); // no duplicate
    expect(replay.json.revision).toBe(rev); // revision unchanged
  });

  it("allows a partial session but rejects an empty one", async () => {
    const ws = fullWorkspace();
    ws.exercises.push({ id: "e2", name: "Press", equipment: "Barbell", prescription: "3x5", cues: ["brace"] });
    ws.programmes[0].exercises.push({ id: "e2", sets: "3x5" });
    await setupCoach(ws);
    const { cookie, csrf } = await memberLogin();

    const none = await req(
      "/api/member/actions",
      "POST",
      { key: "p0", action: "workout", completed: [], entries: [] },
      { cookie, csrf },
    );
    expect(none.status).toBe(400);

    // Only 1 of the 2 programme exercises done — should still log.
    const partial = await req(
      "/api/member/actions",
      "POST",
      { key: "p1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] },
      { cookie, csrf },
    );
    expect(partial.status).toBe(200);
    expect(partial.json.workspace.logs.length).toBe(1);
  });

  it("caps water at 200", async () => {
    await setupCoach(fullWorkspace());
    const { cookie, csrf } = await memberLogin();
    let last: any;
    for (let i = 0; i < 3; i++) {
      last = await req("/api/member/actions", "POST", { key: "w" + i, action: "water" }, { cookie, csrf });
    }
    const water = last.json.workspace.water;
    expect(Object.values(water)[0]).toBe(3);
  });

  it("rejects a non-whole-second row result", async () => {
    await setupCoach(fullWorkspace());
    const { cookie, csrf } = await memberLogin();
    const r = await req(
      "/api/member/actions",
      "POST",
      { key: "r1", action: "result", kind: "2 km row", value: 450.5, date: "2020-01-01" },
      { cookie, csrf },
    );
    expect(r.status).toBe(400);
  });
});

describe("leaderboard", () => {
  it("hides non-opted-in peers from a member but shows them to the coach", async () => {
    const coach = await setupCoach(fullWorkspace());
    const member = await memberLogin(); // c1

    // c1 opts in; c2 stays private (default).
    await req("/api/member/actions", "POST", { key: "p1", action: "privacy", optIn: true }, member);

    const asMember = await req("/api/leaderboard", "GET", undefined, { cookie: member.cookie });
    const memberIds = asMember.json.rows.map((r: any) => r.id).sort();
    expect(memberIds).toEqual(["c1"]); // only self (c2 not opted in)

    const asCoach = await req("/api/leaderboard", "GET", undefined, { cookie: coach.cookie });
    const coachIds = asCoach.json.rows.map((r: any) => r.id).sort();
    expect(coachIds).toEqual(["c1", "c2"]); // coach sees everyone
  });
});
