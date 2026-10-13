import { describe, it, expect, beforeEach } from "vitest";
import { weeklyTests, TEST_POOL, MEASURE_KINDS } from "../src/tests";
import { validateWorkspace } from "../src/validate";
import { today } from "../src/time";
import { req, wipe, fullWorkspace, memberLogin, setupCoach, sampleClient, baseWorkspace } from "./helpers";

describe("weekly test rotation", () => {
  it("returns 3 tests, one per bucket, deterministically", () => {
    const a = weeklyTests("2026-10-13");
    const b = weeklyTests("2026-10-15"); // same week
    expect(a.length).toBe(3);
    expect(a.map((t) => t.kind)).toEqual(b.map((t) => t.kind));
    // one per bucket = three distinct kinds, all from the pool
    expect(new Set(a.map((t) => t.kind)).size).toBe(3);
    for (const t of a) expect(TEST_POOL.some((p) => p.kind === t.kind)).toBe(true);
  });

  it("changes week to week and stays mostly bodyweight", () => {
    const w1 = weeklyTests("2026-10-12").map((t) => t.kind); // Mon
    const w2 = weeklyTests("2026-10-19").map((t) => t.kind); // next Mon
    expect(w1).not.toEqual(w2);
    // equipment tests (Deadlift, 2 km row) can never fill more than 2 slots
    for (const week of [w1, w2]) {
      const kit = week.filter((k) => k === "Deadlift" || k === "2 km row").length;
      expect(kit).toBeLessThanOrEqual(2);
    }
  });

  it("covers every active test over a full cycle; legacy tests never rotate", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 0, 5) + i * 7 * 86400000).toISOString().slice(0, 10);
      for (const t of weeklyTests(d)) seen.add(t.kind);
    }
    const active = TEST_POOL.filter((t) => !t.legacy);
    expect(seen.size).toBe(active.length);
    expect(seen.has("Plank Hold")).toBe(false); // retired — replaced by Back Support Hold
    expect(seen.has("Back Support Hold")).toBe(true);
  });

  it("legacy kinds still validate so stored results stay safe", () => {
    const w = baseWorkspace();
    w.clients = [sampleClient("c1", "a@x.com")];
    w.measures = [{ id: "m1", client: "c1", date: "2026-01-01", kind: "Plank Hold", value: 90 }];
    expect(() => validateWorkspace(w)).not.toThrow();
  });
});

describe("measure validation with the pool", () => {
  it("accepts any pool kind and Body weight, rejects unknown kinds", () => {
    const w = baseWorkspace();
    w.clients = [sampleClient("c1", "a@x.com")];
    w.measures = [
      { id: "m1", client: "c1", date: "2026-01-01", kind: "Max Press-Ups", value: 30 },
      { id: "m2", client: "c1", date: "2026-01-01", kind: "Body weight", value: 82.5 },
      { id: "m3", client: "c1", date: "2026-01-01", kind: "Plank Hold", value: 90 },
    ];
    expect(() => validateWorkspace(w)).not.toThrow();
    w.measures.push({ id: "m4", client: "c1", date: "2026-01-01", kind: "Bench", value: 1 });
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("MEASURE_KINDS includes the full pool + Body weight", () => {
    expect(MEASURE_KINDS.size).toBe(TEST_POOL.length + 1);
  });
});

describe("weekly tests end-to-end", () => {
  beforeEach(wipe);

  it("member logs a weekly test; leaderboard reports it + the battery", async () => {
    const coach = await setupCoach(fullWorkspace());
    const member = await memberLogin();
    const weekly = weeklyTests(today());

    // integer rule: decimal rejected for integer tests
    const intTest = weekly.find((t) => t.int)!;
    const bad = await req(
      "/api/member/actions",
      "POST",
      { key: "t0", action: "result", kind: intTest.kind, value: 10.5, date: today() },
      member,
    );
    expect(bad.status).toBe(400);

    const ok = await req(
      "/api/member/actions",
      "POST",
      { key: "t1", action: "result", kind: intTest.kind, value: 30, date: today() },
      member,
    );
    expect(ok.status).toBe(200);

    const lb = await req("/api/leaderboard", "GET", undefined, { cookie: coach.cookie });
    expect(lb.json.weekly.map((t: any) => t.kind)).toEqual(weekly.map((t) => t.kind));
    const row = lb.json.rows.find((r: any) => r.id === "c1");
    expect(row.tests[intTest.kind]).toBe(30);
    expect(row.testsThisWeek).toBe(1);
  });

  it("a result logged last week does not count in this week's battery", async () => {
    const coach = await setupCoach(fullWorkspace());
    const member = await memberLogin();
    const weekly = weeklyTests(today());
    const lastWeek = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
    await req(
      "/api/member/actions",
      "POST",
      { key: "t2", action: "result", kind: weekly[0].kind, value: 25, date: lastWeek },
      member,
    );
    const lb = await req("/api/leaderboard", "GET", undefined, { cookie: coach.cookie });
    const row = lb.json.rows.find((r: any) => r.id === "c1");
    expect(row.tests[weekly[0].kind]).toBe(null);
    expect(row.testsThisWeek).toBe(0);
  });
});
