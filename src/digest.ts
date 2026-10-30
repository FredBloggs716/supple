// Weekly progress emails: a week-in-review for every member and a club digest
// for the coach, sent by the Sunday-evening cron trigger via Resend.
// Everything is computed from the workspace, matching the app's own numbers
// (leaderboard XP maths, analytics streak/adherence, member timeline weeks).
// Feature-flagged: without RESEND_API_KEY the run is a silent no-op.
import { Env } from "./env";
import { getWorkspace } from "./db";
import { analytics } from "./analytics";
import { today } from "./time";
import { testByKind, weeklyTests } from "./tests";

// ---- date helpers (UTC maths over YYYY-MM-DD keys, like analytics.ts) -------
function parse(s: string): Date {
  return new Date(s + "T00:00:00Z");
}
function addDays(s: string, n: number): string {
  return new Date(parse(s).getTime() + n * 86400000).toISOString().slice(0, 10);
}
function mondayOf(s: string): string {
  return addDays(s, -((parse(s).getUTCDay() + 6) % 7));
}
function dayLabel(s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(parse(s));
}

export const xpFor = (l: any): number =>
  Math.round(50 * (l.exerciseCount ? (l.completedCount ?? l.exerciseCount) / l.exerciseCount : 1));

function fmtValue(kind: string, value: number): string {
  const def = testByKind(kind);
  if (def?.unit === "s" && value >= 90) {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${value}${def ? " " + def.unit : ""}`;
}

// ---- stats ------------------------------------------------------------------
export function memberStats(w: any, c: any): any {
  const now = today();
  const monday = mondayOf(now);
  const logs = w.logs.filter((l: any) => l.client === c.id);
  const weekLogs = logs.filter((l: any) => l.date >= monday && l.date <= now);

  // One cell per weekday: trained or not (any log dated that day, or a slotted
  // log covering that slot this week).
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return {
      date,
      label: dayLabel(date, { weekday: "short" }),
      trained: weekLogs.some((l: any) => l.date === date),
      future: date > now,
    };
  });

  // XP by week, oldest first, for the 4-week trend.
  const trend = [3, 2, 1, 0].map((k) => {
    const start = addDays(monday, -7 * k);
    const end = addDays(start, 6);
    const wl = logs.filter((l: any) => l.date >= start && l.date <= end);
    return { start, label: k === 0 ? "This week" : "w/c " + dayLabel(start), xp: wl.reduce((s: number, l: any) => s + xpFor(l), 0), sessions: wl.length };
  });

  // Programme position (mirrors the member timeline: anchored to the Monday of
  // the first log, running for the programme's weeks).
  const p = w.programmes.find((x: any) => x.id === (c.programmes || [])[0]) || null;
  let programme: any = null;
  if (p) {
    const first = logs.filter((l: any) => l.programme === p.id).reduce((a: string | null, l: any) => (!a || l.date < a ? l.date : a), null);
    const week = first ? Math.min(p.weeks, Math.max(1, Math.floor((parse(monday).getTime() - parse(mondayOf(first)).getTime()) / (7 * 86400000)) + 1)) : 0;
    programme = { name: p.name, week, weeks: p.weeks, frequency: p.frequency, pct: Math.min(100, Math.round((week / p.weeks) * 100)) };
  }

  // Strongest work this week: heaviest entry per exercise, top three by load.
  const exName = new Map(w.exercises.map((e: any) => [e.id, e.name]));
  const best = new Map<string, any>();
  for (const l of weekLogs) {
    for (const en of l.entries || []) {
      const prev = best.get(en.exercise);
      if (!prev || en.weight > prev.weight || (en.weight === prev.weight && en.reps > prev.reps)) best.set(en.exercise, en);
    }
  }
  const lifts = [...best.values()]
    .filter((en) => en.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((en) => ({ name: exName.get(en.exercise) || "Exercise", weight: en.weight, reps: en.reps }));

  // This week's rotating test battery with the member's club position in each
  // (latest result this week per member, direction-aware like the leaderboard).
  const latestThisWeek = (cid: string, kind: string) =>
    w.measures
      .filter((m: any) => m.client === cid && m.kind === kind && m.date >= monday && m.date <= now)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .at(-1);
  const battery = weeklyTests(now).map((t) => {
    const entries = w.clients
      .map((x: any) => ({ id: x.id, m: latestThisWeek(x.id, t.kind) }))
      .filter((e: any) => e.m)
      .sort((a: any, b: any) => (t.dir === "lower" ? a.m.value - b.m.value : b.m.value - a.m.value));
    const idx = entries.findIndex((e: any) => e.id === c.id);
    const mine = idx >= 0 ? entries[idx].m : null;
    let delta: { text: string; good: boolean } | null = null;
    if (mine) {
      const prev = w.measures
        .filter((x: any) => x.client === c.id && x.kind === t.kind && x.date < monday)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .at(-1);
      if (prev && prev.value !== mine.value) {
        const diff = mine.value - prev.value;
        const good = t.dir === "lower" ? diff < 0 : diff > 0;
        delta = { text: `${diff > 0 ? "+" : "−"}${fmtValue(t.kind, Math.abs(diff))} vs last time`, good };
      }
    }
    return {
      kind: t.kind,
      shown: mine ? fmtValue(t.kind, mine.value) : null,
      position: idx >= 0 ? idx + 1 : null,
      entrants: entries.length,
      delta,
    };
  });
  const batteryKinds = new Set(battery.map((b) => b.kind));

  // Any other tests logged this week (outside the battery), with an honest
  // delta against the previous result (direction-aware).
  const tests = w.measures
    .filter((m: any) => m.client === c.id && m.date >= monday && m.date <= now && m.kind !== "Body weight" && !batteryKinds.has(m.kind))
    .map((m: any) => {
      const prev = w.measures
        .filter((x: any) => x.client === c.id && x.kind === m.kind && x.date < monday)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .at(-1);
      const def = testByKind(m.kind);
      let delta: { text: string; good: boolean } | null = null;
      if (prev && prev.value !== m.value) {
        const diff = m.value - prev.value;
        const good = def?.dir === "lower" ? diff < 0 : diff > 0;
        delta = { text: `${diff > 0 ? "+" : "−"}${fmtValue(m.kind, Math.abs(diff))} vs last time`, good };
      }
      return { kind: m.kind, shown: fmtValue(m.kind, m.value), delta };
    });

  // Standing among the whole club this week (the member's own email may say
  // their true rank — it reveals nothing about any named individual).
  const totals = w.clients
    .map((x: any) => ({
      id: x.id,
      xp: w.logs.filter((l: any) => l.client === x.id && l.date >= monday && l.date <= now).reduce((s: number, l: any) => s + xpFor(l), 0),
    }))
    .sort((a: any, b: any) => b.xp - a.xp);
  const rank = totals.findIndex((t: any) => t.id === c.id) + 1;

  return {
    name: c.name.split(/\s+/)[0],
    fullName: c.name,
    email: c.email,
    range: `${dayLabel(monday)} – ${dayLabel(addDays(monday, 6))}`,
    sessions: weekLogs.length,
    goal: p?.frequency || 3,
    xp: weekLogs.reduce((s: number, l: any) => s + xpFor(l), 0),
    streak: c.streak || 0,
    adherence: c.adherence || 0,
    days,
    trend,
    programme,
    lifts,
    battery,
    tests,
    rank,
    of: totals.length,
  };
}

// ---- email markup (tables + inline styles: survives Gmail/Outlook/Apple) ----
// Futuristic night palette: near-black ground, neon cyan/red/green accents.
const NAVY = "#00e5ff", // primary neon accent (was navy) — bars, links, highlights
  RED = "#ff2d55", // neon red — points, alerts, CTA
  INK = "#f2f6ff", // headline text on dark
  MUTED = "#8b93b8",
  BODY = "#c3cae2",
  LINE = "#1c2443", // hairlines on dark cards
  BG = "#11182e", // inset tiles (stat cells, day dots)
  GREEN = "#39ff88", // neon green — goals hit, improvements
  PALE = "#1a2140"; // bar tracks / medal chips
const PAGE = "#05060d", CARD = "#0b101f", HEAD = "#080c18";
const LOGO = "https://socialtrainingclub.uk/assets/logo-mark-white.png";
const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const esc = (v: any): string =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);

function shell(preheader: string, heading: string, sub: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:${PAGE};${FONT}">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:${HEAD};border:1px solid ${LINE};border-bottom:0;border-radius:16px 16px 0 0;padding:34px 36px 30px">
  <img src="${LOGO}" width="46" height="46" alt="Social Training Club" style="display:block;border:0;margin-bottom:16px">
  <div style="${FONT}font-size:10px;letter-spacing:4px;color:${NAVY};font-weight:700">SOCIAL TRAINING CLUB</div>
  <div style="${FONT}font-size:27px;line-height:1.25;color:${INK};font-weight:800;margin-top:10px">${heading}</div>
  <div style="${FONT}font-size:13px;color:${MUTED};margin-top:8px">${esc(sub)}</div>
  <div style="height:3px;width:52px;background:${RED};margin-top:18px;box-shadow:0 0 12px ${RED}"></div>
</td></tr>
${body}
<tr><td style="background:${HEAD};border:1px solid ${LINE};border-top:0;border-radius:0 0 16px 16px;padding:22px 36px;text-align:center">
  <div style="${FONT}font-size:11px;color:${MUTED};line-height:1.8">Good people. Better together.<br>
  Social Training Club · <a href="https://socialtrainingclub.uk" style="color:${NAVY}">socialtrainingclub.uk</a><br>
  You receive this as a club member. Reply to this email to talk to your coach, or ask to stop the weekly recap.</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

function section(inner: string, pad = "26px 36px"): string {
  return `<tr><td style="background:${CARD};border-left:1px solid ${LINE};border-right:1px solid ${LINE};padding:${pad}">${inner}</td></tr>`;
}
function label(text: string): string {
  return `<div style="${FONT}font-size:10px;letter-spacing:2px;color:${MUTED};font-weight:700;margin-bottom:12px">${esc(text)}</div>`;
}
function statCells(stats: Array<[string | number, string, string?]>): string {
  const cell = ([big, small, colour]: [string | number, string, string?]) =>
    `<td align="center" style="background:${BG};border:1px solid ${colour && colour !== INK ? colour : LINE};border-radius:10px;padding:16px 6px">
      <div style="${FONT}font-size:26px;font-weight:800;color:${colour || INK};text-shadow:0 0 14px ${colour || "transparent"}">${esc(big)}</div>
      <div style="${FONT}font-size:10px;letter-spacing:1px;color:${MUTED};font-weight:700;margin-top:4px">${esc(small)}</div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stats
    .map(cell)
    .join('<td style="width:10px"></td>')}</tr></table>`;
}
function barRow(name: string, pct: number, right: string, colour = NAVY): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
  <tr><td style="${FONT}font-size:12px;color:${BODY};padding-bottom:5px">${esc(name)}</td>
  <td align="right" style="${FONT}font-size:12px;font-weight:700;color:${INK};padding-bottom:5px">${esc(right)}</td></tr>
  <tr><td colspan="2"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="background:${PALE};border-radius:6px;height:10px;font-size:0;line-height:0" width="100%">
      <div style="background:${colour};border-radius:6px;height:10px;width:${Math.max(2, Math.min(100, pct))}%;box-shadow:0 0 10px ${colour}">&nbsp;</div>
    </td></tr></table></td></tr></table>`;
}

export function renderMemberEmail(s: any): string {
  const dayDots = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${s.days
    .map((d: any) => {
      const bgc = d.trained ? NAVY : d.future ? CARD : BG;
      const col = d.trained ? "#05060d" : MUTED;
      const brd = d.trained ? NAVY : LINE;
      return `<td align="center" style="padding:0 2px"><div style="background:${bgc};border:1px solid ${brd};border-radius:9px;padding:10px 0">
        <div style="${FONT}font-size:10px;font-weight:700;color:${col}">${esc(d.label)}</div>
        <div style="${FONT}font-size:13px;margin-top:3px;color:${col}">${d.trained ? "✓" : "·"}</div></div></td>`;
    })
    .join("")}</tr></table>`;

  const maxXp = Math.max(50, ...s.trend.map((t: any) => t.xp));
  const trendBars = s.trend
    .map((t: any) => barRow(t.label, (t.xp / maxXp) * 100, `${t.xp} pts · ${t.sessions} session${t.sessions === 1 ? "" : "s"}`, t.label === "This week" ? RED : NAVY))
    .join("");

  const liftRows = s.lifts
    .map(
      (l: any, i: number) => `<tr><td style="${FONT}font-size:13px;color:${BODY};padding:9px 0;border-bottom:1px solid ${LINE}">
      <span style="display:inline-block;width:22px;height:22px;background:${i === 0 ? RED : PALE};color:${i === 0 ? "#fff" : NAVY};border-radius:50%;text-align:center;line-height:22px;font-size:11px;font-weight:800;margin-right:9px">${i + 1}</span>${esc(l.name)}</td>
      <td align="right" style="${FONT}font-size:13px;font-weight:800;color:${INK};border-bottom:1px solid ${LINE}">${esc(l.weight)} kg × ${esc(l.reps)}</td></tr>`,
    )
    .join("");

  const ord = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0] || "th");
  const posChip = (b: any) =>
    b.position
      ? `<span style="display:inline-block;background:${b.position === 1 ? GREEN : NAVY};color:#05060d;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:800;box-shadow:0 0 10px ${b.position === 1 ? GREEN : NAVY}">${ord(b.position)} of ${b.entrants}</span>`
      : `<span style="display:inline-block;border:1px solid ${LINE};color:${MUTED};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700">Not logged</span>`;
  const batteryRows = s.battery
    .map(
      (b: any) => `<tr><td style="${FONT}font-size:13px;color:${BODY};padding:10px 0;border-bottom:1px solid ${LINE}">${esc(b.kind)}
      ${b.delta ? `<div style="${FONT}font-size:11px;font-weight:700;color:${b.delta.good ? GREEN : RED};margin-top:3px">${b.delta.good ? "▲" : "▼"} ${esc(b.delta.text)}</div>` : ""}</td>
      <td align="right" style="${FONT}font-size:13px;border-bottom:1px solid ${LINE};white-space:nowrap">
      ${b.shown ? `<strong style="color:${INK};margin-right:8px">${esc(b.shown)}</strong>` : ""}${posChip(b)}</td></tr>`,
    )
    .join("");
  const batteryDone = s.battery.filter((b: any) => b.position).length;

  const testRows = s.tests
    .map(
      (t: any) => `<tr><td style="${FONT}font-size:13px;color:${BODY};padding:9px 0;border-bottom:1px solid ${LINE}">${esc(t.kind)}</td>
      <td align="right" style="${FONT}font-size:13px;border-bottom:1px solid ${LINE}"><strong style="color:${INK}">${esc(t.shown)}</strong>
      ${t.delta ? `<span style="color:${t.delta.good ? GREEN : RED};font-size:11px;font-weight:700"> ${t.delta.good ? "▲" : "▼"} ${esc(t.delta.text)}</span>` : ""}</td></tr>`,
    )
    .join("");

  const body =
    section(label("YOUR WEEK IN NUMBERS") + statCells([
      [`${s.sessions}/${s.goal}`, "SESSIONS", s.sessions >= s.goal ? GREEN : INK],
      [`${s.xp}`, "CLUB POINTS", RED],
      [`${s.streak}w`, "STREAK"],
    ])) +
    section(label("YOUR TRAINING WEEK") + dayDots) +
    (s.programme
      ? section(
          label("YOUR PROGRAMME") +
            barRow(s.programme.name, s.programme.pct, s.programme.week ? `Week ${s.programme.week} of ${s.programme.weeks}` : "Starts with your first session", RED),
        )
      : "") +
    section(label("LAST FOUR WEEKS") + trendBars) +
    (s.lifts.length ? section(label("STRONGEST WORK THIS WEEK") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${liftRows}</table>`) : "") +
    (s.battery.length
      ? section(
          label("THIS WEEK’S CLUB TESTS") +
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${batteryRows}</table>` +
            (batteryDone < s.battery.length
              ? `<div style="${FONT}font-size:11px;color:${MUTED};margin-top:12px">${batteryDone} of ${s.battery.length} logged — positions update as results land. There's still time this week.</div>`
              : ""),
        )
      : "") +
    (s.tests.length ? section(label("OTHER RESULTS THIS WEEK") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${testRows}</table>`) : "") +
    section(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:${BG};border:1px solid ${NAVY};border-radius:12px;padding:22px 26px;box-shadow:0 0 18px rgba(0,229,255,0.25)">
        <div style="${FONT}font-size:13px;color:${MUTED}">This week you're</div>
        <div style="${FONT}font-size:24px;font-weight:800;color:${NAVY};margin-top:3px;text-shadow:0 0 16px ${NAVY}">#${s.rank} of ${s.of} in the club</div>
      </td><td style="width:12px"></td>
      <td align="center" style="background:${RED};border-radius:12px;padding:22px 10px;box-shadow:0 0 18px rgba(255,45,85,0.4)" width="38%">
        <a href="https://socialtrainingclub.uk" style="${FONT}font-size:13px;font-weight:800;color:#ffffff;text-decoration:none">Open your<br>workspace →</a>
      </td></tr></table>`,
      "26px 36px 30px",
    );

  return shell(
    `${s.sessions} sessions, ${s.xp} club points this week`,
    `Your week at the club,<br>${esc(s.name)}.`,
    `Week in review · ${s.range}`,
    body,
  );
}

export function renderCoachEmail(w: any): string {
  const now = today();
  const monday = mondayOf(now);
  const perClient = w.clients.map((c: any) => memberStats(w, c));
  const sessions = perClient.reduce((s: number, c: any) => s + c.sessions, 0);
  const goal = perClient.reduce((s: number, c: any) => s + c.goal, 0);
  const quiet = perClient.filter((c: any) => !c.sessions);
  const ending = perClient.filter((c: any) => c.programme && c.programme.week >= c.programme.weeks);
  const checkins = w.clients.filter((c: any) => c.checkin).length;

  const rows = perClient
    .sort((a: any, b: any) => b.xp - a.xp)
    .map(
      (c: any) => `<tr>
      <td style="${FONT}font-size:13px;color:${INK};font-weight:700;padding:9px 0;border-bottom:1px solid ${LINE}">${esc(c.fullName)}${c.programme && c.programme.week >= c.programme.weeks ? ` <span style="color:${RED};font-size:10px;font-weight:800">FINAL WEEK</span>` : ""}</td>
      <td align="center" style="${FONT}font-size:13px;color:${c.sessions >= c.goal ? GREEN : c.sessions ? BODY : RED};font-weight:700;border-bottom:1px solid ${LINE}">${c.sessions}/${c.goal}</td>
      <td align="center" style="${FONT}font-size:13px;color:${BODY};border-bottom:1px solid ${LINE}">${c.xp}</td>
      <td align="center" style="${FONT}font-size:13px;color:${BODY};border-bottom:1px solid ${LINE}">${c.streak}w</td></tr>`,
    )
    .join("");

  const body =
    section(label("THE CLUB THIS WEEK") + statCells([
      [`${sessions}/${goal}`, "SESSIONS LOGGED", sessions >= goal ? GREEN : INK],
      [`${quiet.length}`, "WENT QUIET", quiet.length ? RED : GREEN],
      [`${checkins}`, "CHECK-INS WAITING", checkins ? RED : INK],
    ])) +
    section(
      label("EVERY MEMBER, AT A GLANCE") +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="${FONT}font-size:10px;letter-spacing:1px;color:${MUTED};font-weight:700;padding-bottom:6px">MEMBER</td>
        <td align="center" style="${FONT}font-size:10px;letter-spacing:1px;color:${MUTED};font-weight:700">SESSIONS</td>
        <td align="center" style="${FONT}font-size:10px;letter-spacing:1px;color:${MUTED};font-weight:700">POINTS</td>
        <td align="center" style="${FONT}font-size:10px;letter-spacing:1px;color:${MUTED};font-weight:700">STREAK</td></tr>${rows}</table>`,
    ) +
    (quiet.length
      ? section(label("WORTH A NUDGE") + `<div style="${FONT}font-size:13px;color:${BODY};line-height:2">${quiet.map((c: any) => esc(c.fullName)).join(" · ")} didn't log a session this week.</div>`)
      : "") +
    (ending.length
      ? section(label("PROGRAMMES ENDING") + `<div style="${FONT}font-size:13px;color:${BODY};line-height:2">${ending.map((c: any) => `${esc(c.fullName)} — ${esc(c.programme.name)}`).join("<br>")}</div>`)
      : "") +
    section(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${RED};border-radius:12px;padding:18px">
      <a href="https://socialtrainingclub.uk" style="${FONT}font-size:14px;font-weight:800;color:#ffffff;text-decoration:none">Open the coach workspace →</a></td></tr></table>`,
      "26px 36px 30px",
    );

  return shell(
    `${sessions} sessions across the club · ${quiet.length} quiet`,
    "Your club this week.",
    `Coach digest · ${dayLabel(monday)} – ${dayLabel(addDays(monday, 6))}`,
    body,
  );
}

// ---- sending ----------------------------------------------------------------
export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.DIGEST_FROM || "Social Training Club <club@socialtrainingclub.uk>",
      to: [to],
      subject,
      html,
      // Replies go to the coach (club@ can't receive mail), and the
      // List-Unsubscribe header is a mailbox-provider trust signal Yahoo and
      // Gmail score senders on.
      ...(replyTo ? { reply_to: [replyTo] } : {}),
      headers: {
        "List-Unsubscribe": `<mailto:${replyTo || "club@socialtrainingclub.uk"}?subject=unsubscribe%20weekly%20recap>`,
      },
    }),
  });
  if (!res.ok) console.error("DIGEST send failed", to, res.status, await res.text());
  return res.ok;
}

export async function runWeeklyDigest(env: Env): Promise<{ sent: number; skipped?: string }> {
  if (!env.RESEND_API_KEY) return { sent: 0, skipped: "RESEND_API_KEY not configured" };
  const { w } = await getWorkspace(env.DB);
  analytics(w); // streak + adherence, same numbers the app shows
  let sent = 0;
  for (const c of w.clients) {
    if (c.digestOptOut) continue;
    const s = memberStats(w, c);
    if (await sendEmail(env, c.email, `Your week at the club — ${s.sessions} session${s.sessions === 1 ? "" : "s"}, ${s.xp} points`, renderMemberEmail(s), w.settings.email)) sent++;
  }
  if (await sendEmail(env, w.settings.email, "Coach digest — your club this week", renderCoachEmail(w), w.settings.email)) sent++;
  return { sent };
}
