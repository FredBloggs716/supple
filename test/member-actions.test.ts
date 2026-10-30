import { describe, it, expect, beforeEach } from "vitest";
import { req, wipe, fullWorkspace, memberLogin, setupCoach } from "./helpers";

async function member() {
  await setupCoach(fullWorkspace());
  return memberLogin();
}

beforeEach(wipe);

describe("member actions — nutrition & water", () => {
  it("logs a meal", async () => {
    const m = await member();
    const r = await req("/api/member/actions", "POST", { key: "ml1", action: "meal", name: "Lunch", type: "Meal", calories: 500, protein: 30, carbs: 50, fat: 10 }, m);
    expect(r.status).toBe(200);
    expect(r.json.workspace.meals.length).toBe(1);
  });
  it("increments water", async () => {
    const m = await member();
    let last: any;
    for (let i = 0; i < 2; i++) last = await req("/api/member/actions", "POST", { key: "w" + i, action: "water" }, m);
    expect(Object.values(last.json.workspace.water)[0]).toBe(2);
  });
});

describe("member actions — results", () => {
  it("accepts valid benchmark kinds", async () => {
    const m = await member();
    for (const [i, kind] of ["Deadlift", "Body weight", "2 km row"].entries()) {
      const r = await req("/api/member/actions", "POST", { key: "r" + i, action: "result", kind, value: 100, date: "2020-01-01" }, m);
      expect(r.status).toBe(200);
    }
  });
  it("rejects an invalid kind and a fractional row time", async () => {
    const m = await member();
    expect((await req("/api/member/actions", "POST", { key: "x1", action: "result", kind: "Bench", value: 100, date: "2020-01-01" }, m)).status).toBe(400);
    expect((await req("/api/member/actions", "POST", { key: "x2", action: "result", kind: "2 km row", value: 450.5, date: "2020-01-01" }, m)).status).toBe(400);
  });
});

describe("member actions — check-in, privacy, unknown", () => {
  it("records a check-in the coach can see", async () => {
    const coach = await setupCoach(fullWorkspace());
    const m = await memberLogin();
    const r = await req("/api/member/actions", "POST", { key: "ci1", action: "checkin", text: "Feeling strong this week" }, m);
    expect(r.status).toBe(200);
    const coachView = await req("/api/workspace", "GET", undefined, { cookie: coach.cookie });
    const c1 = coachView.json.workspace.clients.find((c: any) => c.id === "c1");
    expect(c1.checkin).toBe("Feeling strong this week");
    expect(c1.status).toBe("Needs attention");
  });
  it("rejects a non-boolean privacy preference and unknown actions", async () => {
    const m = await member();
    expect((await req("/api/member/actions", "POST", { key: "p1", action: "privacy", optIn: "yes" }, m)).status).toBe(400);
    expect((await req("/api/member/actions", "POST", { key: "u1", action: "flylikeabird" }, m)).status).toBe(400);
  });
});

describe("same-day session merging", () => {
  it("logging exercises separately on one day stays ONE session and tops up", async () => {
    const ws = fullWorkspace();
    ws.exercises.push({ id: "e2", name: "Press", equipment: "Barbell", prescription: "3x5", cues: ["brace"] });
    ws.programmes[0].exercises.push({ id: "e2", sets: "3x5" });
    const coach = await setupCoach(ws);
    const m = await memberLogin();

    const first = await req(
      "/api/member/actions",
      "POST",
      { key: "s1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] },
      m,
    );
    expect(first.status).toBe(200);
    expect(first.json.workspace.logs.length).toBe(1);

    const second = await req(
      "/api/member/actions",
      "POST",
      { key: "s2", action: "workout", completed: ["e2"], entries: [{ exercise: "e2", weight: 40, reps: 8 }] },
      m,
    );
    expect(second.status).toBe(200);
    const logs = second.json.workspace.logs;
    expect(logs.length).toBe(1); // merged, not a second session
    expect(logs[0].completedCount).toBe(2);
    expect(logs[0].exerciseCount).toBe(2);
    expect(logs[0].entries.length).toBe(2);

    // leaderboard: one session, full 50 XP once both halves are done
    const lb = await req("/api/leaderboard", "GET", undefined, { cookie: coach.cookie });
    const row = lb.json.rows.find((r: any) => r.id === "c1");
    expect(row.sessions).toBe(1);
    expect(row.xp).toBe(50);
  });

  it("partial day earns proportional XP on the leaderboard", async () => {
    const ws = fullWorkspace();
    ws.exercises.push({ id: "e2", name: "Press", equipment: "Barbell", prescription: "3x5", cues: ["brace"] });
    ws.programmes[0].exercises.push({ id: "e2", sets: "3x5" });
    const coach = await setupCoach(ws);
    const m = await memberLogin();
    await req(
      "/api/member/actions",
      "POST",
      { key: "p1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 60, reps: 5 }] },
      m,
    );
    const lb = await req("/api/leaderboard", "GET", undefined, { cookie: coach.cookie });
    const row = lb.json.rows.find((r: any) => r.id === "c1");
    expect(row.sessions).toBe(1);
    expect(row.xp).toBe(25); // 1 of 2 exercises = half of 50
  });
});

describe("member actions — rotating session logging", () => {
  it("accepts an exercise from the member's injected session (not in the flat list) and sizes XP by the session", async () => {
    // fullWorkspace programme id is "p1", which the member view enriches with
    // PROGRAMME_SESSIONS. "ax-gsq" appears in a p1 session but not p.exercises.
    const m = await member();
    const r = await req(
      "/api/member/actions",
      "POST",
      { key: "sess1", action: "workout", completed: ["ax-gsq"], total: 5, entries: [{ exercise: "ax-gsq", weight: 60, reps: 5 }] },
      m,
    );
    expect(r.status).toBe(200);
    const log = r.json.workspace.logs.find((l: any) => l.programme === "p1");
    expect(log.completedCount).toBe(1);
    expect(log.exerciseCount).toBe(5); // from client-reported session size
  });
});

describe("member actions — workout validation", () => {
  it("rejects entries for an exercise not marked complete and bad loads", async () => {
    const m = await member();
    expect((await req("/api/member/actions", "POST", { key: "bad1", action: "workout", completed: ["e1"], entries: [{ exercise: "ghost", weight: 50, reps: 5 }] }, m)).status).toBe(400);
    expect((await req("/api/member/actions", "POST", { key: "bad2", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 9999, reps: 5 }] }, m)).status).toBe(400);
    expect((await req("/api/member/actions", "POST", { key: "bad3", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 50, reps: 0 }] }, m)).status).toBe(400);
  });
  it("re-logging the same day merges (one session); a replayed key is a no-op", async () => {
    const m = await member();
    const body = (key: string, weight: number) => ({ key, action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight, reps: 5 }] });
    expect((await req("/api/member/actions", "POST", body("k1", 60), m)).status).toBe(200);
    const second = await req("/api/member/actions", "POST", body("k2", 70), m);
    expect(second.json.workspace.logs.length).toBe(1); // merged into today's session
    expect(second.json.workspace.logs[0].entries[0].weight).toBe(70); // latest result wins
    const replay = await req("/api/member/actions", "POST", body("k2", 70), m);
    expect(replay.json.workspace.logs.length).toBe(1);
  });
});
