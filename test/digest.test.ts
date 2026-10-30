import { describe, it, expect } from "vitest";
import { memberStats, renderMemberEmail, renderCoachEmail, runWeeklyDigest, xpFor } from "../src/digest";
import { today } from "../src/time";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  return iso(new Date(Date.parse(today() + "T00:00:00Z") - n * 86400000));
}

function workspace(): any {
  return {
    version: 1,
    settings: { coach: "Dean", club: "STC", email: "coach@example.com" },
    clients: [
      {
        id: "c1", name: "Heidi Yeoman", email: "heidi@example.com", colour: "", goal: "Strength",
        notes: [], targets: { calories: 2000, protein: 120, carbs: 200, fat: 60 },
        programmes: ["p1"], streak: 3, adherence: 80,
      },
      {
        id: "c2", name: "Quiet Quentin", email: "q@example.com", colour: "", goal: "Fitness",
        notes: [], targets: { calories: 2000, protein: 120, carbs: 200, fat: 60 },
        programmes: ["p1"], streak: 0, adherence: 0,
      },
    ],
    programmes: [
      { id: "p1", name: "Express Strength", description: "d", weeks: 4, frequency: 3, colour: "", goal: "Strength",
        exercises: [{ id: "e1", sets: "3x5" }] },
    ],
    exercises: [{ id: "e1", name: "Goblet Squat", equipment: "KB", prescription: "3x5", cues: ["brace"] }],
    logs: [
      // three weeks ago (anchors the programme), plus two this week
      { id: "l0", client: "c1", date: daysAgo(15), type: "Programme session", programme: "p1", entries: [], completedCount: 1, exerciseCount: 1 },
      { id: "l1", client: "c1", date: today(), type: "Programme session", programme: "p1",
        entries: [{ exercise: "e1", weight: 60, reps: 5 }], completedCount: 1, exerciseCount: 2 },
    ],
    measures: [
      { id: "m0", client: "c1", date: daysAgo(10), kind: "2 km row", value: 480 },
      { id: "m1", client: "c1", date: today(), kind: "2 km row", value: 450 },
    ],
    sessions: [], meals: [], water: {}, activity: [], readNotifications: [], feed: [],
  };
}

describe("weekly digest", () => {
  it("xpFor matches the leaderboard's proportional maths", () => {
    expect(xpFor({ completedCount: 1, exerciseCount: 2 })).toBe(25);
    expect(xpFor({ completedCount: 3, exerciseCount: 3 })).toBe(50);
  });

  it("memberStats reports this week's sessions, XP and an improving row time", () => {
    const s = memberStats(workspace(), workspace().clients[0]);
    expect(s.sessions).toBe(1);
    expect(s.xp).toBe(25);
    expect(s.goal).toBe(3);
    expect(s.lifts[0]).toMatchObject({ name: "Goblet Squat", weight: 60, reps: 5 });
    expect(s.tests[0].kind).toBe("2 km row");
    expect(s.tests[0].delta.good).toBe(true); // 450s beats 480s — lower is better
    expect(s.rank).toBe(1);
    expect(s.of).toBe(2);
  });

  it("member email renders the headline numbers and brand frame", () => {
    const w = workspace();
    const html = renderMemberEmail(memberStats(w, w.clients[0]));
    for (const needle of ["Heidi", "SOCIAL TRAINING CLUB", "CLUB POINTS", "Goblet Squat", "2 km row", "#1 of 2", "socialtrainingclub.uk"]) {
      expect(html).toContain(needle);
    }
    expect(html).not.toContain("<script");
  });

  it("coach email flags quiet members and totals the club", () => {
    const html = renderCoachEmail(workspace());
    expect(html).toContain("Coach digest");
    expect(html).toContain("WORTH A NUDGE");
    expect(html).toContain("Quiet Quentin");
    expect(html).toContain("EVERY MEMBER, AT A GLANCE");
  });

  it("run is a safe no-op without an API key", async () => {
    const r = await runWeeklyDigest({} as any);
    expect(r.sent).toBe(0);
    expect(r.skipped).toContain("RESEND_API_KEY");
  });
});
