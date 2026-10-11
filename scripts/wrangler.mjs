// Launch wrangler with the x64 workerd binary that matches wrangler's own
// miniflare version (Windows-on-ARM64 has no native build; the x64 exe runs
// under emulation). See patch-workerd-arm64.mjs for the vitest-side equivalent.
import { spawnSync } from "node:child_process";
import path from "node:path";

process.env.MINIFLARE_WORKERD_PATH = path.resolve(
  import.meta.dirname,
  "../node_modules/workerd-win64-wrangler/bin/workerd.exe",
);

const r = spawnSync("npx", ["wrangler", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
