// Merge the Ascent exercise library + 10 programmes into a club via the real
// (validated, revision-checked) coach API. Additive only. Idempotent.
// Needs env: BASE, COOKIE (stc_session=...), CSRF.
import fs from "node:fs";
import { exercises, programmes } from "./ascent-content.mjs";

const vmap = JSON.parse(fs.readFileSync(new URL("./video-map.json", import.meta.url)));
for (const e of exercises) {
  if (vmap[e.name]) e.videoUrl = "https://www.youtube.com/watch?v=" + vmap[e.name];
}

const BASE = process.env.BASE;
const headers = { cookie: process.env.COOKIE };
const got = await (await fetch(BASE + "/api/workspace", { headers })).json();
if (!got.workspace) {
  console.error("FAILED to read workspace (auth?):", JSON.stringify(got));
  process.exit(1);
}
const ws = got.workspace;
const exIds = new Set(ws.exercises.map((e) => e.id));
const pgIds = new Set(ws.programmes.map((p) => p.id));
let addedE = 0;
let addedP = 0;
for (const e of exercises) if (!exIds.has(e.id)) (ws.exercises.push(e), addedE++);
for (const p of programmes) if (!pgIds.has(p.id)) (ws.programmes.push(p), addedP++);

const put = await fetch(BASE + "/api/workspace", {
  method: "PUT",
  headers: { ...headers, "content-type": "application/json", "x-csrf-token": process.env.CSRF },
  body: JSON.stringify({ workspace: ws, revision: got.revision }),
});
const pj = await put.json().catch(() => ({}));
console.log(
  `PUT ${put.status} | added ${addedE} exercises, ${addedP} programmes | ` +
    (put.ok ? `new revision ${pj.revision}` : `error: ${pj.error}`),
);
process.exit(put.ok ? 0 : 1);
