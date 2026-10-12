import { describe, it, expect } from "vitest";
import { analytics, viewFor } from "../src/analytics";
import { today } from "../src/time";

function ws(): any {
  return {
    version: 1,
    settings: { coach: "Coach", club: "Club", email: "c@x.com" },
    water: { "c1-x": 3, "c2-y": 1 },
    clients: [
      { id: "c1", name: "Sam Jones", email: "a@x.com", colour: "blue", programme: "p1", notes: [{ text: "secret", date: "2020-01-01" }], targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 } },
      { id: "c2", name: "Jo Bloggs", email: "b@x.com", colour: "sage", programme: "p1", notes: [], targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 } },
    ],
    programmes: [{ id: "p1", name: "P", description: "d", weeks: 4, frequency: 3, colour: "", exercises: [{ id: "e1", sets: "3x5" }] }],
    exercises: [{ id: "e1", name: "Squat", equipment: "Barbell", prescription: "3x5", cues: ["brace"] }],
    logs: [],
    measures: [{ id: "m1", client: "c2", date: "2020-01-01", kind: "Deadlift", value: 180 }],
    sessions: [{ id: "s1", name: "S", date: today(), time: "09:00", clients: ["c1", "c2"], duration: 60, attended: ["c1"] }],
    meals: [{ id: "ml1", client: "c2", date: "2020-01-01", name: "Lunch", calories: 500, protein: 30, carbs: 50, fat: 10 }],
    activity: [{ id: "a1", title: "x", text: "y", date: "2020-01-01", icon: "checkCircle", tone: "green" }],
  };
}

describe("analytics", () => {
  it("gives zero adherence/streak with no logs", () => {
    const w = analytics(ws());
    const c1 = w.clients.find((c: any) => c.id === "c1");
    expect(c1.adherence).toBe(0);
    expect(c1.streak).toBe(0);
  });

  it("computes adherence from this week's sessions vs frequency", () => {
    const w = ws();
    w.logs = [
      { id: "l1", client: "c1", date: today() },
      { id: "l2", client: "c1", date: today() },
    ];
    analytics(w);
    const c1 = w.clients.find((c: any) => c.id === "c1");
    expect(c1.adherence).toBe(67); // round(2/3*100)
    expect(c1.streak).toBe(1);
  });
});

describe("viewFor isolation", () => {
  it("gives the coach the full workspace", () => {
    const v = viewFor({ role: "coach" }, ws());
    expect(v.clients.length).toBe(2);
    expect(v.clients[0].notes.length).toBe(1);
    expect(v.settings.email).toBe("c@x.com");
  });

  it("restricts a member to their own data only", () => {
    const v = viewFor({ role: "member", client: "c1" }, ws());
    expect(v.clients.map((c: any) => c.id)).toEqual(["c1"]);
    expect(v.clients[0].notes).toEqual([]); // coach notes stripped
    expect(v.measures.every((m: any) => m.client === "c1")).toBe(true); // c2's deadlift hidden
    expect(v.meals.length).toBe(0); // c2's meal hidden
    expect(v.activity).toEqual([]); // activity feed hidden
    expect(v.settings.email).toBeUndefined(); // coach email hidden
    expect(Object.keys(v.water)).toEqual(["c1-x"]); // only own water
    // session is scoped to the member, attendance only reflects them
    expect(v.sessions[0].clients).toEqual(["c1"]);
    expect(v.sessions[0].attended).toEqual(["c1"]);
  });

  it("throws if the member's client record is gone", () => {
    expect(() => viewFor({ role: "member", client: "ghost" }, ws())).toThrow();
  });
});
