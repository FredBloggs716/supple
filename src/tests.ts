// Weekly benchmark test rotation. A pool of 15 tests in 3 balanced buckets
// (strength/power, engine, control/core); each Monday the week's battery is one
// test per bucket, chosen deterministically from the calendar week — the same
// for every client and device, with no stored state. Mostly bodyweight; at most
// one equipment test per bucket, so every week has >=2 kit-free tests.
// NOTE: public/tests.js mirrors this for the front-end — keep them in sync.

export interface TestDef {
  kind: string; // stored on measures as `kind`
  unit: "reps" | "s" | "kg" | "cm";
  dir: "higher" | "lower";
  int: boolean; // whole numbers only
}

const A: TestDef[] = [
  { kind: "Max Press-Ups", unit: "reps", dir: "higher", int: true },
  { kind: "Max Pull-Ups", unit: "reps", dir: "higher", int: true },
  { kind: "Wall Sit Hold", unit: "s", dir: "higher", int: true },
  { kind: "Broad Jump", unit: "cm", dir: "higher", int: true },
  { kind: "Air Squats in 60s", unit: "reps", dir: "higher", int: true },
  { kind: "Deadlift", unit: "kg", dir: "higher", int: false },
];
const B: TestDef[] = [
  { kind: "Burpees in 3 Minutes", unit: "reps", dir: "higher", int: true },
  { kind: "2 km row", unit: "s", dir: "lower", int: true },
  { kind: "1-Mile Run", unit: "s", dir: "lower", int: true },
  { kind: "Step-Ups in 3 Minutes", unit: "reps", dir: "higher", int: true },
];
const C: TestDef[] = [
  { kind: "Plank Hold", unit: "s", dir: "higher", int: true },
  { kind: "Dead Hang", unit: "s", dir: "higher", int: true },
  { kind: "Hollow Hold", unit: "s", dir: "higher", int: true },
  { kind: "Wall Handstand Hold", unit: "s", dir: "higher", int: true },
  { kind: "Single-Leg Balance (Eyes Closed)", unit: "s", dir: "higher", int: true },
];

export const TEST_POOL: TestDef[] = [...A, ...B, ...C];

// "Body weight" is loggable but private — never part of the rotation/leaderboard.
export const MEASURE_KINDS = new Set<string>([
  "Body weight",
  ...TEST_POOL.map((t) => t.kind),
]);

export function testByKind(kind: string): TestDef | undefined {
  return TEST_POOL.find((t) => t.kind === kind);
}

// Week index from a fixed epoch Monday (2024-01-01).
function weekIndex(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = Date.UTC(y, m - 1, d);
  const dow = (new Date(date).getUTCDay() + 6) % 7; // Mon=0
  const monday = date - dow * 86400000;
  return Math.floor((monday - Date.UTC(2024, 0, 1)) / (7 * 86400000));
}

// This week's battery: one strength/power, one engine, one control/core.
export function weeklyTests(dateIso: string): TestDef[] {
  const w = weekIndex(dateIso);
  return [A[w % A.length], B[w % B.length], C[w % C.length]];
}
