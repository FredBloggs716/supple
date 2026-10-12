// Load/refresh the Ascent library + group-based programmes into a club via the
// real validated coach API. REPLACES prior ax-/ap- content (remove then add),
// preserves everything else. Needs env: BASE, COOKIE (stc_session=...), CSRF.
import fs from "node:fs";
import * as core from "./ascent-content.mjs";
import * as expansion from "./ascent-expansion.mjs";
import * as gym from "./ascent-gymnastics.mjs";
import * as sj from "./ascent-superjoints.mjs";

const exercises = [...core.exercises, ...expansion.exercises, ...gym.exercises, ...sj.exercises];
const programmes = [...core.programmes, ...gym.programmes, ...sj.programmes];

const map = {};
for (const f of ["video-map.json", "video-map-2.json", "video-map-3.json", "video-map-4.json", "video-map-5.json"]) {
  Object.assign(map, JSON.parse(fs.readFileSync(new URL("./" + f, import.meta.url))));
}
// Exercise display names that differ from the video-map key.
const ALIAS = {
  "Split Squat (Hold)": "Split Squat",
  "Inverted / Ring Row": "Inverted Row",
  "Kettlebell Clean & Press": "Kettlebell Clean and Press",
};
let missing = 0;
for (const e of exercises) {
  const id = map[ALIAS[e.name] || e.name];
  if (id) e.videoUrl = "https://www.youtube.com/watch?v=" + id;
  else missing++;
}
if (missing) console.log(`WARN: ${missing} exercises have no video link`);

const BASE = process.env.BASE;
const headers = { cookie: process.env.COOKIE };
const got = await (await fetch(BASE + "/api/workspace", { headers })).json();
if (!got.workspace) {
  console.error("FAILED to read workspace (auth?):", JSON.stringify(got));
  process.exit(1);
}
const ws = got.workspace;

// Replace prior Ascent content.
ws.exercises = ws.exercises.filter((e) => !e.id.startsWith("ax-")).concat(exercises);
ws.programmes = ws.programmes.filter((p) => !p.id.startsWith("ap-")).concat(programmes);

// Guard: clear any client assigned to a programme that no longer exists.
const progIds = new Set(ws.programmes.map((p) => p.id));
for (const c of ws.clients) if (c.programme && !progIds.has(c.programme)) c.programme = "";

const put = await fetch(BASE + "/api/workspace", {
  method: "PUT",
  headers: { ...headers, "content-type": "application/json", "x-csrf-token": process.env.CSRF },
  body: JSON.stringify({ workspace: ws, revision: got.revision }),
});
const pj = await put.json().catch(() => ({}));
console.log(
  `PUT ${put.status} | ${exercises.length} exercises, ${programmes.length} programmes | ` +
    (put.ok ? `new revision ${pj.revision}` : `error: ${pj.error}`),
);
process.exit(put.ok ? 0 : 1);
