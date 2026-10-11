// Windows-on-ARM64 has no native workerd build. The x64 binary runs fine under
// emulation, but workerd's resolver (lib/main.js) throws "Unsupported platform"
// because its knownPackages map has no "win32 arm64 LE" key. This patch adds that
// key to every workerd copy under node_modules so wrangler dev and
// @cloudflare/vitest-pool-workers (miniflare) both resolve the x64 .exe.
// Idempotent; safe to run repeatedly. Wired as postinstall.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";

const needle = '"win32 x64 LE": "@cloudflare/workerd-windows-64"';
const added = needle + ',\n  "win32 arm64 LE": "@cloudflare/workerd-windows-64"';

let patched = 0;
const files = globSync("node_modules/**/workerd/lib/main.js");
for (const file of files) {
  if (!existsSync(file)) continue;
  let src = readFileSync(file, "utf8");
  if (src.includes('"win32 arm64 LE"')) continue; // already patched
  if (!src.includes(needle)) continue;
  src = src.replace(needle, added);
  writeFileSync(file, src);
  patched++;
  console.log("patched " + file);
}
console.log(`workerd arm64 patch: ${patched} file(s) updated, ${files.length} found.`);
