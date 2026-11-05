// Floating weekly-challenge ticker — a slow marquee pinned to the top of the
// page showing THIS WEEK'S live test battery (from tests.js, calendar-derived,
// same on every device). Appended to <body> so it survives the apps' #app
// redraws. Mounted on the landing page, the coach app and the member app.

import { weeklyTests } from "./tests.js";
import { TODAY } from "./data.js";
import { icon } from "./icons.js";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export function mountChallengeTicker() {
  if (document.getElementById("challenge-ticker")) return;

  const tests = weeklyTests(TODAY);
  if (!tests.length) return;

  // One pass of this week's challenges...
  const seq = tests
    .map((t) => `<span class="ticker-item"><i class="tdot"></i>${esc(t.kind)}</span>`)
    .join("");
  // ...repeated an even number of times so translateX(-50%) loops seamlessly,
  // and wide enough that a half-track always fills the viewport.
  const run = seq.repeat(12);

  const bar = document.createElement("div");
  bar.id = "challenge-ticker";
  bar.className = "challenge-ticker";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "This week's club challenges");
  bar.innerHTML =
    `<div class="ticker-label">${icon("trophy")}This week's challenges</div>` +
    `<div class="ticker-viewport"><div class="ticker-track">${run}</div></div>`;

  document.body.prepend(bar);
}
