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
function exercise(id: string): any {
  return { id, name: "Squat", equipment: "Barbell", prescription: "3x5", cues: ["brace"] };
}
function client(id: string, email: string, programme = ""): any {
  return {
    id,
    name: "Sam Jones",
    email,
    colour: "blue",
    programme,
    notes: [],
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
  };
}

describe("field validators", () => {
  it("text trims and enforces limits", () => {
    expect(text("  hi  ", "x")).toBe("hi");
    expect(() => text("", "x")).toThrow();
    expect(() => text("a".repeat(201), "x", 200)).toThrow();
  });
  it("number rejects booleans and out-of-range", () => {
    expect(number(5, "x", 1, 10)).toBe(5);
    expect(() => number(true as unknown as number, "x")).toThrow();
    expect(() => number(99, "x", 1, 10)).toThrow();
  });
  it("date enforces ISO and past-only when required", () => {
    expect(date("2020-01-15")).toBe("2020-01-15");
    expect(() => date("2020-13-01")).toThrow();
    expect(() => date("not-a-date")).toThrow();
    expect(() => date("2999-01-01", false)).toThrow();
  });
  it("email normalises and validates", () => {
    expect(email("A@B.com")).toBe("a@b.com");
    expect(() => email("nope")).toThrow();
  });
});

describe("validateWorkspace", () => {
  it("accepts a minimal valid workspace", () => {
    expect(() => validateWorkspace(base())).not.toThrow();
  });
  it("rejects wrong version", () => {
    const w = base();
    w.version = 2;
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("rejects duplicate record IDs within a collection", () => {
    const w = base();
    w.exercises = [exercise("e1"), exercise("e1")];
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("rejects a client referencing a missing programme", () => {
    const w = base();
    w.clients = [client("c1", "a@x.com", "missing")];
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("rejects duplicate client emails", () => {
    const w = base();
    w.clients = [client("c1", "same@x.com"), client("c2", "same@x.com")];
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("rejects a session with 0 or >6 members", () => {
    const w = base();
    w.clients = [client("c1", "a@x.com")];
    const session = (clients: string[]): any => ({
      id: "s1",
      name: "Session",
      date: "2020-01-01",
      time: "09:00",
      clients,
      duration: 60,
    });
    w.sessions = [session([])];
    expect(() => validateWorkspace(w)).toThrow();
    w.clients = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((id) => client(id, id + "@x.com"));
    w.sessions = [session(["c1", "c2", "c3", "c4", "c5", "c6", "c7"])];
    expect(() => validateWorkspace(w)).toThrow();
  });
  it("rejects invalid measurement kinds and water counts", () => {
    const w = base();
    w.clients = [client("c1", "a@x.com")];
    w.measures = [{ id: "m1", client: "c1", date: "2020-01-01", kind: "Bench", value: 100 }];
    expect(() => validateWorkspace(w)).toThrow();
    const w2 = base();
    w2.water = { "c1-2020-01-01": 999 };
    expect(() => validateWorkspace(w2)).toThrow();
  });
});
