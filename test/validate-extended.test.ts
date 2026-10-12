import { describe, it, expect } from "vitest";
import { validateWorkspace, text, number, date, email } from "../src/validate";

function base(): any {
  return {
    version: 1,
    settings: { coach: "Coach", club: "Club", email: "coach@example.com" },
    water: {},
    clients: [],
    programmes: [],
    exercises: [],
    logs: [],
    measures: [],
    sessions: [],
    meals: [],
    activity: [],
  };
}
const exr = (id: string): any => ({ id, name: "Squat", equipment: "Barbell", prescription: "3x5", cues: ["brace"] });
const cli = (id: string, e: string, programme = ""): any => ({
  id, name: "Sam", email: e, colour: "blue", programme, notes: [], targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
});

describe("text validator", () => {
  it("trims, enforces limit, requires non-empty unless optional", () => {
    expect(text("  a ", "x")).toBe("a");
    expect(text("", "x", 200, true)).toBe("");
    expect(() => text("", "x")).toThrow();
    expect(() => text("a".repeat(5), "x", 4)).toThrow();
    expect(() => text(5 as any, "x")).toThrow();
  });
});

describe("number validator", () => {
  it("rejects booleans, NaN, Infinity, and out-of-range", () => {
    expect(number(3, "x", 1, 5)).toBe(3);
    expect(() => number(true as any, "x")).toThrow();
    expect(() => number(NaN, "x")).toThrow();
    expect(() => number(Infinity, "x")).toThrow();
    expect(() => number(0, "x", 1, 5)).toThrow();
    expect(() => number(6, "x", 1, 5)).toThrow();
  });
});

describe("date validator", () => {
  it("requires strict ISO and valid calendar dates", () => {
    expect(date("2020-02-29")).toBe("2020-02-29"); // leap year
    expect(() => date("2021-02-29")).toThrow(); // not a leap year
    expect(() => date("2020-1-1")).toThrow(); // not zero-padded
    expect(() => date("2020-13-01")).toThrow();
    expect(() => date("2020-00-01")).toThrow();
    expect(() => date(20200101 as any)).toThrow();
  });
  it("enforces past-only when future=false", () => {
    expect(() => date("2999-01-01", false)).toThrow();
    expect(date("2000-01-01", false)).toBe("2000-01-01");
  });
});

describe("email validator", () => {
  it("lowercases and validates shape", () => {
    expect(email("A.B@C.CO")).toBe("a.b@c.co");
    for (const bad of ["x", "x@y", "x y@z.co", "@z.co", "x@.co"]) expect(() => email(bad)).toThrow();
  });
});

describe("validateWorkspace structural rules", () => {
  it("requires version 1 and valid settings", () => {
    expect(() => validateWorkspace({ ...base(), version: 2 })).toThrow();
    const w = base(); w.settings = { coach: "C", club: "", email: "c@x.com" };
    expect(() => validateWorkspace(w)).toThrow();
    const w2 = base(); w2.water = []; // must be object not array
    expect(() => validateWorkspace(w2)).toThrow();
  });
  it("rejects over-long collections and bad record ids", () => {
    const w = base(); w.exercises = [{ ...exr("has space") }];
    expect(() => validateWorkspace(w)).toThrow();
    const w2 = base(); w2.exercises = [exr("e1"), exr("e1")];
    expect(() => validateWorkspace(w2)).toThrow();
  });
  it("enforces client colour, notes, targets, checkin", () => {
    const w = base(); w.clients = [{ ...cli("c1", "a@x.com"), colour: "neon" }];
    expect(() => validateWorkspace(w)).toThrow();
    const w2 = base(); w2.clients = [{ ...cli("c1", "a@x.com"), targets: { calories: 0, protein: 1, carbs: 1, fat: 1 } }];
    expect(() => validateWorkspace(w2)).toThrow(); // calories must be >=1
    const w3 = base(); w3.clients = [{ ...cli("c1", "a@x.com"), notes: [{ text: "", date: "2020-01-01" }] }];
    expect(() => validateWorkspace(w3)).toThrow();
  });
  it("validates programmes: weeks, frequency, colour, exercise refs", () => {
    const mk = (over: any) => { const w = base(); w.exercises = [exr("e1")]; w.programmes = [{ id: "p1", name: "P", description: "d", weeks: 4, frequency: 3, colour: "", exercises: [{ id: "e1", sets: "3x5" }], ...over }]; return w; };
    expect(() => validateWorkspace(mk({}))).not.toThrow();
    expect(() => validateWorkspace(mk({ weeks: 53 }))).toThrow();
    expect(() => validateWorkspace(mk({ frequency: 8 }))).toThrow();
    expect(() => validateWorkspace(mk({ colour: "neon" }))).toThrow();
    expect(() => validateWorkspace(mk({ exercises: [] }))).toThrow();
    expect(() => validateWorkspace(mk({ exercises: [{ id: "missing", sets: "x" }] }))).toThrow();
  });
  it("validates exercises incl optional videoUrl", () => {
    const w = base(); w.exercises = [{ ...exr("e1"), cues: [] }];
    expect(() => validateWorkspace(w)).toThrow(); // needs >=1 cue
    const w2 = base(); w2.exercises = [{ ...exr("e1"), videoUrl: "https://youtu.be/abc" }];
    expect(() => validateWorkspace(w2)).not.toThrow();
    const w3 = base(); w3.exercises = [{ ...exr("e1"), videoUrl: "x".repeat(201) }];
    expect(() => validateWorkspace(w3)).toThrow();
  });
  it("validates sessions: time format, 1-6 unique clients, duration", () => {
    const s = (over: any) => { const w = base(); w.clients = [cli("c1", "a@x.com"), cli("c2", "b@x.com")]; w.sessions = [{ id: "s1", name: "S", date: "2020-01-01", time: "09:00", clients: ["c1"], duration: 60, ...over }]; return w; };
    expect(() => validateWorkspace(s({}))).not.toThrow();
    expect(() => validateWorkspace(s({ time: "25:00" }))).toThrow();
    expect(() => validateWorkspace(s({ time: "9:00" }))).toThrow();
    expect(() => validateWorkspace(s({ clients: [] }))).toThrow();
    expect(() => validateWorkspace(s({ clients: ["c1", "c1"] }))).not.toThrow(); // set-dedup = 1, still valid
    expect(() => validateWorkspace(s({ duration: 5 }))).toThrow();
    expect(() => validateWorkspace(s({ clients: ["nope"] }))).toThrow();
  });
  it("validates measures, meals, water and record->client links", () => {
    const w = base(); w.clients = [cli("c1", "a@x.com")];
    w.measures = [{ id: "m1", client: "c1", date: "2020-01-01", kind: "Bench", value: 100 }];
    expect(() => validateWorkspace(w)).toThrow(); // bad kind
    const w2 = base(); w2.clients = [cli("c1", "a@x.com")];
    w2.logs = [{ id: "l1", client: "ghost", date: "2020-01-01" }];
    expect(() => validateWorkspace(w2)).toThrow(); // missing client
    const w3 = base(); w3.water = { k: 201 };
    expect(() => validateWorkspace(w3)).toThrow();
  });
});
