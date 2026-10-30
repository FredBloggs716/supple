// Loads Ascent exercise + programme library into the live D1 database via
// the Cloudflare D1 REST API. Reads the OAuth token from wrangler's local
// auth config — no HTTP session cookie required.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

import * as core from "./ascent-content.mjs";
import * as expansion from "./ascent-expansion.mjs";
import * as gym from "./ascent-gymnastics.mjs";
import * as sj from "./ascent-superjoints.mjs";

const exercises = [...core.exercises, ...expansion.exercises, ...gym.exercises, ...sj.exercises];
const programmes = [...core.programmes, ...gym.programmes, ...sj.programmes];

// Attach video URLs
const map = {};
for (const f of ["video-map.json", "video-map-2.json", "video-map-3.json", "video-map-4.json", "video-map-5.json"]) {
  Object.assign(map, JSON.parse(fs.readFileSync(path.join(__dirname, f))));
}
const ALIAS = {
  "Split Squat (Hold)": "Split Squat",
  "Inverted / Ring Row": "Inverted Row",
  "Kettlebell Clean & Press": "Kettlebell Clean and Press",
};
let missing = 0;
for (const e of exercises) {
  const id = map[ALIAS[e.name] || e.name];
  if (id) e.videoUrl = "https://www.youtube.com/watch?v=" + id;
  else { console.warn("WARN: no video for", e.name); missing++; }
}
console.log(`Videos: ${exercises.length - missing}/${exercises.length} matched`);

// Read OAuth token from wrangler config
const wranglerConfig = path.join(os.homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml");
const toml = fs.readFileSync(wranglerConfig, "utf8");
const tokenMatch = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!tokenMatch) { console.error("Could not read oauth_token from wrangler config"); process.exit(1); }
const token = tokenMatch[1];

const DATABASE_ID = "18ca15a4-2d0f-48f1-936e-bf6a4410b644";

// Get account ID
const accountsRes = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=1", {
  headers: { Authorization: `Bearer ${token}` },
});
const accountsJson = await accountsRes.json();
if (!accountsJson.success) { console.error("Failed to fetch accounts:", JSON.stringify(accountsJson.errors)); process.exit(1); }
const accountId = accountsJson.result[0].id;
console.log(`Account: ${accountsJson.result[0].name} (${accountId})`);

// Helper: query D1 via REST API
async function d1Query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );
  const json = await res.json();
  if (!json.success) throw new Error("D1 query failed: " + JSON.stringify(json.errors));
  return json.result;
}

// Read current workspace
console.log("Reading workspace from D1...");
const selectResult = await d1Query("SELECT data, revision FROM workspace WHERE id=1");
const rows = selectResult?.[0]?.results;
if (!rows?.length) { console.error("No workspace row found"); process.exit(1); }

const { data: wsJson, revision } = rows[0];
const ws = JSON.parse(wsJson);
console.log(`Workspace: revision=${revision}, ${ws.exercises?.length ?? 0} exercises, ${ws.programmes?.length ?? 0} programmes`);

// Replace Ascent content, preserve everything else
ws.exercises = (ws.exercises || []).filter(e => !e.id.startsWith("ax-")).concat(exercises);
ws.programmes = (ws.programmes || []).filter(p => !p.id.startsWith("ap-")).concat(programmes);

// Guard: clear programme assignments that no longer exist
const progIds = new Set(ws.programmes.map(p => p.id));
for (const c of (ws.clients || [])) if (c.programme && !progIds.has(c.programme)) c.programme = "";

const newRevision = revision + 1;
const newData = JSON.stringify(ws);

// Write updated workspace back
console.log(`Writing ${exercises.length} exercises + ${programmes.length} programmes to D1...`);
await d1Query("UPDATE workspace SET data=?1, revision=?2 WHERE id=1", [newData, newRevision]);

console.log(`Done. revision ${revision} → ${newRevision} | ${exercises.length} exercises, ${programmes.length} programmes loaded.`);
