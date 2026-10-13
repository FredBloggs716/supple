// Weekly benchmark test rotation — front-end mirror of src/tests.ts.
// One test per bucket each week, deterministic from the calendar week, so every
// device shows the same battery with no server round-trip. Keep in sync.

const A = [
  { kind: "Max Press-Ups", unit: "reps", dir: "higher", int: true },
  { kind: "Max Pull-Ups", unit: "reps", dir: "higher", int: true },
  { kind: "Wall Sit Hold", unit: "s", dir: "higher", int: true },
  { kind: "Broad Jump", unit: "cm", dir: "higher", int: true },
  { kind: "Air Squats in 60s", unit: "reps", dir: "higher", int: true },
  { kind: "Deadlift", unit: "kg", dir: "higher", int: false },
];
const B = [
  { kind: "Burpees in 3 Minutes", unit: "reps", dir: "higher", int: true },
  { kind: "2 km row", unit: "s", dir: "lower", int: true },
  { kind: "1-Mile Run", unit: "s", dir: "lower", int: true },
  { kind: "Step-Ups in 3 Minutes", unit: "reps", dir: "higher", int: true },
];
const C = [
  { kind: "Plank Hold", unit: "s", dir: "higher", int: true },
  { kind: "Dead Hang", unit: "s", dir: "higher", int: true },
  { kind: "Hollow Hold", unit: "s", dir: "higher", int: true },
  { kind: "Wall Handstand Hold", unit: "s", dir: "higher", int: true },
  { kind: "Single-Leg Balance (Eyes Closed)", unit: "s", dir: "higher", int: true },
];

export const TEST_POOL = [...A, ...B, ...C];

export function testByKind(kind) {
  return TEST_POOL.find((t) => t.kind === kind);
}

export function weeklyTests(dateIso) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = Date.UTC(y, m - 1, d);
  const dow = (new Date(date).getUTCDay() + 6) % 7;
  const monday = date - dow * 86400000;
  const w = Math.floor((monday - Date.UTC(2024, 0, 1)) / (7 * 86400000));
  return [A[w % A.length], B[w % B.length], C[w % C.length]];
}

export function formatResult(kind, value) {
  if (value == null) return "—";
  const t = testByKind(kind);
  if (!t) return String(value) + " kg"; // Body weight / unknown
  if (t.unit === "s" && t.dir === "lower") {
    return Math.floor(value / 60) + ":" + String(Math.round(value % 60)).padStart(2, "0");
  }
  return value + { reps: " reps", s: " s", kg: " kg", cm: " cm" }[t.unit];
}
