import { api, logout } from "./auth.js";
import { icon } from "./icons.js";
import { TODAY, mondayOf, offsetDay } from "./data.js";
import { weeklyTests, testByKind, formatResult } from "./tests.js";
export function startMemberApp(session) {
  let data = session.workspace,
    route = "today",
    board = "Attendance",
    resultKind = "Deadlift",
    modalFocus = null,
    rows = [],
    chatMessages = [];
  // Normalize old single-programme string to array
  for (const c of data.clients) {
    if (!Array.isArray(c.programmes)) { c.programmes = c.programme ? [c.programme] : []; delete c.programme; }
  }
  const $ = (s) => document.querySelector(s);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const member = () => data.clients[0];
  const assignedIds = () => (member().programmes || []);
  const plan = (pid = null) => {
    if (pid) return data.programmes.find((p) => p.id === pid) || null;
    const ids = assignedIds();
    return ids.length ? (data.programmes.find((p) => p.id === ids[0]) || null) : null;
  };
  const count = () =>
    data.logs.filter((l) => l.date >= mondayOf(TODAY) && l.date <= TODAY)
      .length;
  const nav = [
    ["today", "home", "Today"],
    ["programme", "book", "My programme"],
    ["stcprogrammes", "book", "STC programmes"],
    ["chat", "message", "Victor"],
    ["nutrition", "nutrition", "Nutrition"],
    ["progress", "chart", "Progress"],
    ["library", "video", "Exercise library"],
    ["club", "trophy", "The club"],
    ["account", "user", "My account"],
  ];
  const PROG_CATS = {
    "S&C":         ["p0","p1","p3","p4","p5","ap-triphasic","ap-power","ap-platform","ap-tendon"],
    Kettlebell:    ["ap-kb","ap-found"],
    Gymnastics:    ["ap-hs1","ap-hs2","ap-hs3","ap-gym1","ap-gym2","ap-gym3","ap-gym4","ap-gym5"],
    Calisthenics:  ["ap-exstr","ap-excon"],
    Mobility:      ["p2","ap-mobility","ap-superjoints"],
    "Touch Rugby": [],
    Rugby:         [],
  };
  const avatar = () =>
    `<span class="avatar ${esc(member().colour)}">${esc(
      member()
        .name.split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join(""),
    )}</span>`;
  const btn = (label, action, ic = "", cls = "", extra = "") =>
    `<button class="btn ${cls}" data-member-action="${action}" ${extra}>${ic ? icon(ic) : ""}${esc(label)}</button>`;
  const title = (name, sub, action = "") =>
    `<div class="page-heading"><div><div class="eyebrow">YOUR PLACE IN THE CLUB</div><h1>${esc(name)}</h1><p>${esc(sub)}</p></div><div class="heading-actions">${action}</div></div>`;
  const empty = (name, sub, ic = "book") =>
    `<section class="panel"><div class="empty-state">${icon(ic)}<h3>${esc(name)}</h3><p>${esc(sub)}</p></div></section>`;
  const dateLabel = (d) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/London",
    }).format(new Date(d + "T12:00:00"));
  // Proportional club points: a partial session earns its completed share of 50.
  const xpFor = (l) =>
    Math.round(50 * (l.exerciseCount ? (l.completedCount ?? l.exerciseCount) / l.exerciseCount : 1));
  const xpWeek = () =>
    data.logs
      .filter((l) => l.date >= mondayOf(TODAY) && l.date <= TODAY)
      .reduce((s, l) => s + xpFor(l), 0);
  const sessionToday = (pid = null) => {
    const p = plan(pid);
    return p ? data.logs.find((l) => l.date === TODAY && l.programme === p.id) : null;
  };
  const startLabel = (full, pid = null) => {
    const l = sessionToday(pid);
    if (!l) return full ? "Start your session" : "Start session";
    return (l.completedCount ?? 1) >= (l.exerciseCount ?? 1) ? "Session done — review" : "Continue today's session";
  };
  const lastSession = (pid) => {
    return data.logs
      .filter((l) => l.programme === pid && l.date < TODAY && Array.isArray(l.entries) && l.entries.length)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  };
  const programmeSessions = (pid) => data.logs.filter((l) => l.programme === pid).length;
  const weekNum = (p) => p ? Math.min(p.weeks, Math.floor(programmeSessions(p.id) / Math.max(1, p.frequency)) + 1) : 1;
  const currentSession = (p) => {
    if (!p || !Array.isArray(p.sessions) || !p.sessions.length) return null;
    return p.sessions[programmeSessions(p.id) % p.sessions.length];
  };
  const results = () =>
    data.measures
      .filter((m) => m.kind === resultKind)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8);
  const latest = (kind) =>
    data.measures
      .filter((m) => m.kind === kind)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)?.value;
  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").innerHTML = icon("checkCircle") + esc(message);
    $("#toast").classList.add("show");
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
  }
  function normalizeMember(d) {
    for (const c of d.clients) {
      if (!Array.isArray(c.programmes)) { c.programmes = c.programme ? [c.programme] : []; delete c.programme; }
    }
  }
  async function update(action, fields = {}) {
    const res = await api("/api/member/actions", {
      method: "POST",
      body: { action, key: crypto.randomUUID(), ...fields },
    });
    data = res.workspace;
    normalizeMember(data);
    render();
  }
  function metric(label, value, unit = "") {
    return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)} <small>${esc(unit)}</small></strong><span>One step at a time.</span></div>`;
  }
  function programmeRows(progArg = null, check = false) {
    const p = progArg || plan();
    const sess = currentSession(p);
    const exerciseList = sess ? sess.exercises : (p ? p.exercises : []);
    const thumb = (e) => {
      const m = String(e.videoUrl || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
      return m
        ? `<button class="workout-thumb-btn" data-member-action="exercise" data-id="${e.id}" aria-label="Watch ${esc(e.name)} demonstration"><img src="https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg" alt="" loading="lazy">${icon("play")}</button>`
        : "";
    };
    const todayLog = p ? data.logs.find((l) => l.date === TODAY && l.programme === p.id) : null;
    const doneToday = new Map((todayLog?.entries || []).map((en) => [en.exercise, en]));
    const prev = check ? lastSession(p?.id) : null;
    const prevEntries = new Map((prev?.entries || []).map((en) => [en.exercise, en]));
    return exerciseList.map((item, i) => {
        const e = data.exercises.find((e) => e.id === item.id);
        const prior = doneToday.get(e.id);
        const last = prevEntries.get(e.id);
        const lastHint = last ? `<small class="field-help" style="margin-top:4px">Last session: ${last.weight} kg × ${last.reps} reps</small>` : "";
        return `<div class="workout-row"><span class="workout-index">${String(i + 1).padStart(2, "0")}</span>${thumb(e)}<div><strong>${esc(e.name)}</strong><small>${esc(item.sets)} · ${esc(e.equipment)}</small><button class="text-link" style="font-size:10px;margin-top:7px" data-member-action="exercise" data-id="${e.id}">Technique guide${icon("play")}</button></div>${check ? (prior ? `<div class="set-log"><span class="pill success">Done today · ${prior.weight} kg × ${prior.reps}</span></div>` : `<div class="set-log">${lastHint}<label>Load (kg)<input name="weight-${e.id}" type="number" min="0" max="1000" step="0.5" value="${last?.weight ?? 0}" aria-label="${esc(e.name)} load in kg"></label><label>Reps<input name="reps-${e.id}" type="number" min="1" max="1000" value="${last?.reps ?? 10}" aria-label="${esc(e.name)} reps"></label><label class="done-check"><input type="checkbox" name="complete" value="${e.id}">Done</label></div>`) : prior ? `<span class="pill success">Done today</span>` : `<span class="mono">${esc(item.sets)}</span>`}</div>`;
      })
      .join("");
  }
  function todayPage() {
    const next = data.sessions
      .filter((s) => s.date >= TODAY && s.status !== "Completed")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    const p0 = plan();
    const wk = p0 ? weekNum(p0) : null;
    const prevS = p0 ? lastSession(p0.id) : null;
    const nextSess = p0 ? currentSession(p0) : null;
    const heroSub = p0
      ? `Week ${wk} of ${p0.weeks} · ${programmeSessions(p0.id)} sessions logged${prevS ? " · Last: " + dateLabel(prevS.date) : ""}${nextSess ? " · Next: " + nextSess.name : ""}`
      : "Your coach will assign your programme here. For now, make yourself at home.";
    return `${title("Good to see you, " + member().name.split(" ")[0] + ".", "A little consistency. A little support. Your next step is here.", btn("Check in with coach", "checkin", "message", "accent"))}<div class="metrics-grid section-gap">${metric("This week", count(), "sessions")}${metric("Training streak", member().streak, "weeks")}${metric("Club points", xpWeek(), "XP")}</div><div class="hero member-hero"><div><div class="eyebrow">${p0 ? "YOUR TRAINING PLAN" : "A PLACE TO START"}</div><h2>${esc(p0?.name || "Welcome to your club.")}</h2><p>${esc(heroSub)}</p><div class="hero-actions">${p0 ? btn(startLabel(true), "start-workout", "arrow", "white", `data-programme="${p0.id}"`) : btn("Send a check-in", "checkin", "arrow", "white")}</div></div><img src="assets/logo-mark-white.png" class="member-hero-mark" alt=""></div><div class="two-col section-gap" style="margin-top:22px"><section class="panel"><div class="panel-head"><h2>Your next session</h2>${icon("calendar")}</div>${next ? `<div class="session-row"><span class="session-time">${esc(next.time)}</span><i class="session-bar"></i><div class="session-info"><strong>${esc(next.name)}</strong><small>${dateLabel(next.date)} · ${next.duration} min · Coach ${esc(next.coach)}</small></div></div>` : '<div class="panel-pad muted">No sessions booked yet. Your coach will add them here.</div>'}<div class="panel-footer"><span>Keep a little space in your week for yourself.</span></div></section><section class="panel"><div class="panel-head"><h2>This week's tests</h2>${icon("target")}</div>${weeklyTests(TODAY)
      .map((t) => {
        const mine = data.measures
          .filter((m) => m.kind === t.kind && m.date >= mondayOf(TODAY) && m.date <= TODAY)
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const done = mine.length > 0;
        return `<div class="meal-row"><span class="meal-icon">${icon(done ? "checkCircle" : "target")}</span><div><strong>${esc(t.kind)}</strong><small>${done ? "Logged · " + formatResult(t.kind, mine[mine.length - 1].value) : "Not logged yet this week"}</small></div>${done ? '<span class="pill success">Done</span>' : btn("Log", "result", "plus", "small", `data-kind="${esc(t.kind)}"`)}</div>`;
      })
      .join("")}<div class="panel-footer"><span>Three club tests rotate every Monday. Log them to take your place on the board.</span></div></section></div><div class="two-col section-gap" style="margin-top:22px"><section class="panel panel-pad"><h2>A few words for your coach.</h2><p class="muted" style="font-size:12px;line-height:1.8;margin:13px 0 18px">How’s training feeling? Share what’s going well, and where a little help would go a long way.</p>${btn("Send a check-in", "checkin", "message", "small")}</section><section class="panel"><div class="panel-head"><h2>Recent training</h2>${icon("dumbbell")}</div>${
      data.logs
        .slice(-4)
        .reverse()
        .map(
          (l) =>
            `<div class="meal-row"><span class="meal-icon">${icon("checkCircle")}</span><div><strong>${esc(l.type)}</strong><small>${dateLabel(l.date)} · Session complete</small></div><span class="pill success">+${xpFor(l)} XP</span></div>`,
        )
        .join("") ||
      '<div class="panel-pad muted">Your first session will appear here.</div>'
    }</section>`;
  }
  function programmePage() {
    const ids = assignedIds();
    const assigned = ids.map((id) => data.programmes.find((p) => p.id === id)).filter(Boolean);
    const catalogue = data.programmes.filter((p) => !ids.includes(p.id));

    let html = title(
      "A plan with purpose.",
      assigned.length
        ? `${assigned.length} programme${assigned.length > 1 ? "s" : ""} assigned to you`
        : "Browse what's on offer below.",
    );

    if (assigned.length) {
      for (const p of assigned) {
        const wk = weekNum(p);
        const total = programmeSessions(p.id);
        const prev = lastSession(p.id);
        const nextS = currentSession(p);
        const progressLine = `Week ${wk} of ${p.weeks} · ${total} session${total !== 1 ? "s" : ""} logged${prev ? " · Last: " + dateLabel(prev.date) : ""}${nextS ? " · Next: " + nextS.name : ""}`;
        const guideHtml = p.guide
          ? `<details class="coach-guide"><summary>Coach's guide${icon("book")}</summary><p style="font-size:13px;line-height:1.9;margin-bottom:14px">${esc(p.guide.intro)}</p><ol class="technique-list">${(p.guide.tips || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ol></details>`
          : "";
        html += `<section class="panel" style="margin-bottom:22px"><div class="programme-cover"><span class="eyebrow">YOUR ASSIGNED PROGRAMME</span><img class="cover-mark" src="assets/logo-mark-white.png" alt=""><h3>${esc(p.name)}</h3></div><div class="panel-pad"><p style="font-size:11px;color:var(--muted);margin-bottom:10px">${esc(progressLine)}</p><p style="font-size:13px;line-height:1.8;margin-bottom:14px">${esc(p.description)}</p>${guideHtml}${programmeRows(p)}<div style="margin-top:20px">${btn(startLabel(false, p.id), "start-workout", "play", "accent", `data-programme="${esc(p.id)}"`)}</div></div></section>`;
      }
    } else {
      html += empty(
        "Your training starts with you.",
        "Send your coach a check-in to talk about your goals.",
      );
    }

    if (catalogue.length) {
      html += `<div class="page-heading" style="margin-top:28px"><div><div class="eyebrow">ALL CLUB PROGRAMMES</div><h2>What's on offer.</h2><p>Your coach will assign the right one for you.</p></div></div>`;
      for (const p of catalogue) {
        html += `<section class="panel" style="margin-bottom:16px"><div class="programme-cover ${esc(p.colour)}" style="padding:22px 24px 18px"><span class="eyebrow">SOCIAL TRAINING CLUB</span><img class="cover-mark" src="assets/logo-mark${p.colour === "light" ? "" : "-white"}.png" alt="" style="opacity:0.25"><h3>${esc(p.name)}</h3></div><div class="panel-pad"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="pill neutral">${esc(p.goal)}</span><span class="pill neutral">${p.weeks} weeks</span><span class="pill neutral">${p.frequency} sessions/week</span></div><p style="font-size:12px;line-height:1.8">${esc(p.description)}</p></div></section>`;
      }
    }

    return html;
  }
  function stcProgrammesPage() {
    const ids = assignedIds();
    const catOrder = Object.keys(PROG_CATS);
    const bucketed = {};
    const seen = new Set();
    for (const cat of catOrder) {
      bucketed[cat] = PROG_CATS[cat]
        .map((id) => data.programmes.find((p) => p.id === id))
        .filter(Boolean);
      for (const p of bucketed[cat]) seen.add(p.id);
    }
    const overflow = data.programmes.filter((p) => !seen.has(p.id));
    if (overflow.length) {
      bucketed["Other"] = overflow;
      catOrder.push("Other");
    }
    let html = title("Everything the club offers.", "Browse all programmes by category. Your coach assigns the right one for you.");
    for (const cat of catOrder) {
      const progs = bucketed[cat] || [];
      html += `<div class="page-heading" style="margin-top:28px;margin-bottom:6px"><div><div class="eyebrow">${esc(cat.toUpperCase())}</div><h2>${esc(cat)}</h2></div></div>`;
      if (!progs.length) {
        html += `<section class="panel" style="margin-bottom:16px"><div class="panel-pad muted">Coming soon — check back after the next club update.</div></section>`;
        continue;
      }
      for (const p of progs) {
        const mine = ids.includes(p.id);
        html += `<section class="panel" style="margin-bottom:14px"><div class="programme-cover ${esc(p.colour)}" style="padding:22px 24px 18px"><span class="eyebrow">${mine ? "YOUR ASSIGNED PROGRAMME" : "SOCIAL TRAINING CLUB"}</span><img class="cover-mark" src="assets/logo-mark${p.colour === "light" ? "" : "-white"}.png" alt="" style="opacity:0.25"><h3>${esc(p.name)}</h3></div><div class="panel-pad"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="pill neutral">${esc(p.goal)}</span><span class="pill neutral">${p.weeks} weeks</span><span class="pill neutral">${p.frequency} sessions/week</span>${mine ? '<span class="pill success">Your programme</span>' : ""}</div><p style="font-size:12px;line-height:1.8">${esc(p.description)}</p>${mine ? `<div style="margin-top:14px"><button class="btn small" data-member-nav="programme">${icon("arrow")}Go to my programme</button></div>` : ""}</div></section>`;
      }
    }
    return html;
  }
  function nutritionPage() {
    const meals = data.meals.filter((m) => m.date === TODAY);
    const total = meals.reduce(
      (a, m) => {
        for (const k of ["calories", "protein", "carbs", "fat"]) a[k] += m[k];
        return a;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    const water = data.water[member().id + "-" + TODAY] || 0;
    return `${title("Fuel the work.", "Your daily targets, set with your coach.", btn("Log food", "meal", "plus", "accent"))}<div class="stats-grid">${[
      ["calories", "Energy", "kcal"],
      ["protein", "Protein", "g"],
      ["carbs", "Carbs", "g"],
      ["fat", "Fats", "g"],
    ]
      .map(
        ([key, label, unit]) =>
          `<div class="stat"><div class="stat-top">${label}${icon("nutrition")}</div><div class="stat-number">${Math.round(total[key] * 10) / 10}<small>${unit}</small></div><div class="stat-bottom">of ${member().targets[key]} ${unit} daily target</div><div class="progress-track" style="margin-top:13px"><i style="width:${Math.min(100, (total[key] / member().targets[key]) * 100)}%"></i></div></div>`,
      )
      .join(
        "",
      )}</div><div class="two-col"><section class="panel"><div class="panel-head"><h2>On the plate</h2><span class="pill neutral">Today</span></div>${meals.map((m) => `<div class="meal-row"><span class="meal-icon">${icon("nutrition")}</span><div><strong>${esc(m.name)}</strong><small>${esc(m.type)} · ${m.protein}g protein · ${m.carbs}g carbs · ${m.fat}g fat</small></div><span class="mono">${m.calories} kcal</span></div>`).join("") || '<div class="panel-pad muted">Log your first meal of the day.</div>'}</section><div class="stack"><section class="panel panel-pad"><h2>A little more water.</h2><p class="muted" style="margin-top:12px">${(water * 0.25).toFixed(2)} L logged · 2 L goal</p><div class="water-controls"><div class="water-glasses">${Array.from({ length: 8 }, (_, i) => icon("drop", i < water ? "filled" : "")).join("")}</div>${btn("250 ml", "water", "plus", "small")}</div></section><div class="tip">${icon("nutrition")}<div><strong>Consistency over perfection.</strong>One meal doesn’t define a week. Build habits you can keep coming back to.</div></div></div></div>`;
  }
  function progressChart() {
    const points = results();
    if (!points.length)
      return '<div class="empty-state">Log your first result to start your chart.</div>';
    const values = points.map((p) => p.value),
      max = Math.max(...values) * 1.1;
    const x = (i) => 35 + (i * 500) / Math.max(1, points.length - 1),
      y = (v) => 175 - (v / max) * 150;
    return `<div class="chart-wrap"><svg viewBox="0 0 570 205" role="img" aria-label="${esc(points.map((p) => dateLabel(p.date) + ": " + p.value).join(", "))}">${[0, 1, 2, 3].map((i) => `<line x1="35" x2="535" y1="${y((max * i) / 3)}" y2="${y((max * i) / 3)}" stroke="#e6e9f0"/><text x="25" y="${y((max * i) / 3) + 4}" text-anchor="end">${Math.round((max * i) / 3)}</text>`).join("")}<polyline points="${values.map((v, i) => x(i) + "," + y(v)).join(" ")}" fill="none" stroke="#002c8c" stroke-width="3"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="#002c8c"/><text x="${x(i)}" y="200" text-anchor="middle">${dateLabel(p.date)}</text>`).join("")}</svg></div>`;
  }
  function progressPage() {
    const kinds = [...new Set([...weeklyTests(TODAY).map((t) => t.kind), "Body weight", ...data.measures.map((m) => m.kind)])];
    if (!kinds.includes(resultKind)) resultKind = kinds[0];
    return `${title("See the work add up.", "Keep a clear picture of your own progress.", btn("Log result", "result", "plus", "accent"))}<div class="metrics-grid section-gap">${metric("Latest deadlift", latest("Deadlift") ?? "—", "kg")}${metric("Latest body weight", latest("Body weight") ?? "—", "kg")}${metric("This week", count(), "sessions")}</div><section class="panel large-chart"><div class="panel-head"><h2>Your progress</h2><span class="pill neutral">Latest 8 results</span></div><div class="chart-options"><div class="tabs">${[...new Set([...weeklyTests(TODAY).map((t) => t.kind), "Body weight", ...data.measures.map((m) => m.kind)])].map((k) => `<button class="tab ${resultKind === k ? "active" : ""}" data-member-action="metric" data-value="${esc(k)}">${esc(k)}</button>`).join("")}</div></div>${progressChart()}<div class="panel-footer"><span>${resultKind === "Body weight" ? "Your body weight is private to you and your coach." : "Keep the conditions consistent between tests."}</span></div></section>`;
  }
  function exerciseCards(query = "") {
    const list = data.exercises.filter((e) =>
      (e.name + " " + e.category).toLowerCase().includes(query.toLowerCase()),
    );
    const thumb = (e) => {
      const m = String(e.videoUrl || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
      return m ? `<img class="exercise-thumb" src="https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg" alt="" loading="lazy">` : "";
    };
    return (
      list
        .map(
          (e, i) =>
            `<article class="panel exercise-card"><div class="exercise-visual${thumb(e) ? " has-thumb" : ""}">${thumb(e)}<span class="eyebrow">THE MOVEMENT LIBRARY</span>${thumb(e) ? "" : icon("dumbbell")}<span class="exercise-index">STC / ${String(i + 1).padStart(3, "0")}</span><button class="play-button" data-member-action="exercise" data-id="${e.id}" aria-label="View ${esc(e.name)}">${icon(e.video || e.videoUrl ? "play" : "arrow")}</button></div><div class="programme-body"><h3>${esc(e.name)}</h3><div class="programme-meta"><span>${esc(e.equipment)}</span><span>${e.video || e.videoUrl ? "Video demonstration" : "Technique guide"}</span></div><div class="exercise-category"><span class="pill neutral">${esc(e.category)}</span>${btn("View", "exercise", "arrow", "small", `data-id="${e.id}"`)}</div></div></article>`,
        )
        .join("") ||
      '<div class="empty-state">No movements found. Try another search.</div>'
    );
  }
  function libraryPage() {
    return `${title("Move with confidence.", "Your coach’s cues and demonstrations, in one place.")}<div class="toolbar"><label class="search-field">${icon("search")}<input id="member-exercise-search" type="search" placeholder="Search exercises..." aria-label="Search exercises"></label></div><div class="cards-grid" id="member-exercises">${exerciseCards()}</div>`;
  }
  function clubPage() {
    const weekly = weeklyTests(TODAY);
    if (board !== "Attendance" && !weekly.some((t) => t.kind === board))
      board = "Attendance";
    const boardTest = weekly.find((t) => t.kind === board);
    const list = rows
      .filter((r) => board === "Attendance" || r.tests?.[board] != null)
      .sort((a, b) =>
        board === "Attendance"
          ? b.sessions - a.sessions || b.adherence - a.adherence
          : boardTest?.dir === "lower"
            ? a.tests[board] - b.tests[board]
            : b.tests[board] - a.tests[board],
      );
    return `${title("A little friendly competition.", "Your club. Your people. Celebrate showing up.", btn("Log a test result", "result", "plus", "accent"))}<div class="leader-hero"><div><div class="eyebrow">STRONGER TOGETHER</div><h2>Different starting points.<br>One team.</h2><p>Every session counts. Earn 50 XP each time you train.</p></div>${icon("trophy")}</div>${!member().leaderboardOptIn ? '<div class="tip section-gap">' + icon("shield") + "<div><strong>You control what you share.</strong>Turn on club participation in My account to share your attendance and benchmarks. Body weight and coach notes always stay private.</div></div>" : ""}<section class="panel" style="margin-bottom:22px"><div class="panel-head"><h2>Club feed</h2>${(() => { let wa = ""; try { const u = new URL(data.settings.whatsapp || ""); if (u.protocol === "https:") wa = u.href; } catch {} return wa ? `<a class="btn small" href="${esc(wa)}" target="_blank" rel="noopener">${icon("message")}Club WhatsApp</a>` : icon("users"); })()}</div>${(data.feed || []).length ? (data.feed || []).map((f) => { const mine = f.client === member().id; const liked = (f.kudos || []).includes(member().id); const what = f.kind === "test" ? `${esc(f.title)} · ${formatResult(f.title, f.value)}` : `${esc(f.title)} · ${esc(f.detail)}`; return `<div class="meal-row"><span class="meal-icon">${icon(f.kind === "test" ? "target" : "checkCircle")}</span><div><strong>${esc(f.name)}${mine ? " (you)" : ""}</strong><small>${dateLabel(f.date)} · ${what}</small></div><button class="btn small ${liked ? "primary" : ""}" data-member-action="kudos" data-id="${f.id}" aria-label="Give kudos">🔥${(f.kudos || []).length ? " " + (f.kudos || []).length : ""}</button></div>`; }).join("") : `<div class="panel-pad muted">Sessions and test results appear here as the club trains. ${member().leaderboardOptIn ? "Log a session to start the feed." : "Turn on club participation in My account to share yours."}</div>`}</section><section class="panel"><div class="panel-head"><h2>The club leaderboard</h2><span class="pill neutral">${board === "Attendance" ? "This week" : "This week's test"}</span></div><div class="chart-options" style="padding-bottom:17px"><div class="tabs">${["Attendance", ...weekly.map((t) => t.kind)].map((k) => `<button class="tab ${board === k ? "active" : ""}" data-member-action="board" data-value="${esc(k)}">${esc(k)}</button>`).join("")}</div></div><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Club member</th><th>${board === "Attendance" ? "Sessions" : "Result"}</th><th>${board === "Attendance" ? "Tests + points" : "Club points"}</th></tr></thead><tbody>${list.map((r, i) => `<tr><td><span class="rank ${i === 0 ? "top" : ""}">${String(i + 1).padStart(2, "0")}</span></td><td><strong>${esc(r.name)}</strong>${r.id === member().id ? '<span class="pill neutral" style="margin-left:8px">You</span>' : ""}</td><td class="mono">${board === "Attendance" ? r.sessions : formatResult(board, r.tests[board])}</td><td>${board === "Attendance" ? `<span class="pill ${r.testsThisWeek ? "success" : "neutral"}">${r.testsThisWeek ?? 0}/3 tests</span> <span class="pill success">${r.xp ?? r.sessions * 50} XP</span>` : `<span class="pill success">${r.xp ?? r.sessions * 50} XP</span>`}</td></tr>`).join("") || '<tr><td colspan="4">No results logged this week yet. Your next result can start the board.</td></tr>'}</tbody></table></div></section>`;
  }
  function chatPage() {
    const messages = chatMessages;
    function chatBubbles() {
      if (!messages.length) return '<div class="chat-empty"><p>Ask me anything — technique, which programme suits you, how to progress, nutrition basics, or how to use the app.</p></div>';
      return messages.map(m => {
        const safeContent = esc(m.content).replace(/\n/g, "<br>");
        return `<div class="chat-msg chat-msg--${m.role}"><div class="chat-bubble">${safeContent}</div></div>`;
      }).join("");
    }
    function refreshMsgs() {
      const el = document.getElementById("chat-msgs");
      if (!el) return;
      el.innerHTML = chatBubbles();
      el.scrollTop = el.scrollHeight;
    }
    // Wire up the form after the page HTML lands in the DOM
    setTimeout(() => {
      const form = document.getElementById("chat-form");
      if (!form) return;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("chat-input");
        const send = document.getElementById("chat-send");
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        messages.push({ role: "user", content: text });
        const loadingMsg = { role: "assistant", content: "…" };
        messages.push(loadingMsg);
        refreshMsgs();
        if (send) send.disabled = true;
        try {
          const res = await api("/api/chat", {
            method: "POST",
            body: { messages: messages.filter(m => m !== loadingMsg).map(m => ({ role: m.role, content: m.content })) },
          });
          const idx = messages.indexOf(loadingMsg);
          if (idx !== -1) messages[idx] = { role: "assistant", content: res.reply };
        } catch {
          const idx = messages.indexOf(loadingMsg);
          if (idx !== -1) messages[idx] = { role: "assistant", content: "Victor is temporarily unavailable. Try again in a moment." };
        }
        refreshMsgs();
        if (send) send.disabled = false;
      });
    }, 0);
    return `${title("Victor", "Ask anything about your training, the programmes or how the app works.")}<div class="chat-wrap"><div class="chat-messages" id="chat-msgs">${chatBubbles()}</div><form class="chat-input-row" id="chat-form"><input class="chat-input" id="chat-input" type="text" placeholder="Ask Victor…" autocomplete="off" maxlength="500" required><button class="btn accent" type="submit" id="chat-send">Send</button></form></div>`;
  }
  function accountPage() {
    return `${title("Your corner of the club.", "A few details, just for you.")}<div class="two-col"><section class="panel panel-pad"><div class="profile-head">${avatar()}<div><h3>${esc(member().name)}</h3><p>${esc(member().email)}</p></div></div><div class="info-row"><span>Your coach</span><strong>${esc(data.settings.coach)}</strong></div><div class="info-row"><span>Your goal</span><strong>${esc(member().goal)}</strong></div><form id="member-privacy"><div class="settings-row"><div><strong>Join the club leaderboard</strong><p>Share your first name, last initial, attendance and training benchmarks with signed-in club members. Your body weight stays private.</p></div><label class="switch"><input name="optIn" type="checkbox" ${member().leaderboardOptIn ? "checked" : ""} aria-label="Join the club leaderboard"><span></span></label></div><button class="btn primary" type="submit">Save preference${icon("check")}</button></form></section><section class="panel panel-pad"><h2>Your sign-in details</h2><p class="muted" style="font-size:12px;line-height:1.8;margin:13px 0 22px">Your records are shared only with your coach. Sign out when you finish on a shared device.</p><div class="account-actions">${btn("Change password", "password", "shield", "full")}${btn("Sign out", "logout", "arrow", "full")}</div></section></div>`;
  }
  function render() {
    document.title = `${nav.find((n) => n[0] === route)?.[2]} · Social Training Club`;
    $("#app").innerHTML =
      `<button class="menu-scrim" data-member-action="menu-close" aria-label="Close navigation"></button><aside class="sidebar"><a class="brand" href="#today" data-member-nav="today"><img src="assets/logo-mark.png" alt=""><div class="wordmark">SOCIAL<br>TRAINING CLUB<span>STRONGER TOGETHER</span></div></a><div class="workspace-switch"><span class="workspace-icon">${icon("users")}</span><span><strong>Member workspace</strong><small>${esc(data.settings.club)}</small></span></div><p class="nav-label">YOUR TRAINING</p><nav class="nav-list">${nav.map(([key, ic, name]) => `<button class="nav-link ${key === route ? "active" : ""}" data-member-nav="${key}" ${key === route ? 'aria-current="page"' : ""}>${icon(ic)}${name}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="club-note">${icon("heart")}<strong>Good people. Better together.</strong>Keep showing up. We’re in your corner.</div><button class="coach-profile" data-member-nav="account">${avatar()}<span><strong>${esc(member().name)}</strong><small>Club member</small></span>${icon("chevron")}</button></div></aside><div class="shell"><header class="topbar"><button class="icon-btn mobile-menu" data-member-action="menu" aria-label="Open navigation">${icon("menu")}</button><div class="breadcrumbs"><span>Your club</span>${icon("chevron")}<strong>${nav.find((n) => n[0] === route)?.[2]}</strong></div><button class="icon-btn" data-member-nav="account" aria-label="Your account">${avatar()}</button></header><main class="content" id="main" tabindex="-1">${{ today: todayPage, programme: programmePage, stcprogrammes: stcProgrammesPage, chat: chatPage, nutrition: nutritionPage, progress: progressPage, library: libraryPage, club: clubPage, account: accountPage }[route]()}<footer class="page-footer"><span class="footer-brand"><img src="assets/logo-mark.png" alt="">Social Training Club · Built on showing up.</span><span class="local-status"><i class="dot"></i>Shared with your coach</span></footer></main></div>`;
  }
  async function go(next) {
    route = nav.some((n) => n[0] === next) ? next : "today";
    close();
    history.replaceState(null, "", "#" + route);
    if (route === "club") rows = (await api("/api/leaderboard")).rows;
    render();
    window.scrollTo(0, 0);
  }
  function modal(title, sub, body) {
    if (!$("#modal-root").children.length) modalFocus = document.activeElement;
    $("#modal-root").innerHTML =
      `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="member-dialog-title"><header class="modal-head"><div><h2 id="member-dialog-title">${esc(title)}</h2><p>${esc(sub)}</p></div><button class="icon-btn" data-member-action="close" aria-label="Close dialog">${icon("x")}</button></header><div class="modal-body">${body}</div></section></div>`;
    document.body.classList.add("body-lock");
    ($(".modal input") || $(".modal textarea") || $(".modal button"))?.focus();
  }
  function close() {
    const focus = modalFocus;
    $("#modal-root").innerHTML = "";
    document.body.classList.remove("body-lock");
    modalFocus = null;
    if (focus?.isConnected) focus.focus();
  }
  const footer = (label) =>
    `<p class="form-error" role="alert"></p><div class="modal-footer">${btn("Cancel", "close")}<button class="btn primary" type="submit">${label}${icon("check")}</button></div>`;
  const actions = {
    logout,
    close,
    menu: () => {
      $(".sidebar").classList.add("open");
      $(".menu-scrim").classList.add("open");
    },
    "menu-close": () => {
      $(".sidebar")?.classList.remove("open");
      $(".menu-scrim")?.classList.remove("open");
    },
    water: async () => {
      await update("water");
      toast("250 ml logged. Keep it flowing.");
    },
    metric: (el) => {
      resultKind = el.dataset.value;
      render();
    },
    board: (el) => {
      board = el.dataset.value;
      render();
    },
    checkin: () =>
      modal(
        "A few words for your coach.",
        "What’s going well, and where could a little support help?",
        `<form id="member-checkin"><label class="field"><span>Your check-in</span><textarea name="text" maxlength="2000" required placeholder="How has training felt this week?">${esc(member().checkin || "")}</textarea></label>${footer("Send check-in")}</form>`,
      ),
    kudos: async (el) => {
      await update("kudos", { id: el.dataset.id });
    },
    "start-workout": (el) => {
      const pid = el?.dataset?.programme || plan()?.id;
      const p = pid ? plan(pid) : plan();
      if (!p) return;
      const ws = currentSession(p);
      const todayLog = data.logs.find((l) => l.date === TODAY && l.programme === p.id);
      const doneN = todayLog?.completedCount ?? (todayLog?.entries?.length || 0);
      const totalN = (ws ? ws.exercises : p.exercises)?.length || 0;
      const sub = `${p.name}${ws ? " · " + ws.name : ""}${doneN ? ` · ${doneN} of ${totalN} done today` : ""}`;
      modal(
        "Today’s session.",
        sub,
        `<form id="member-workout" data-programme="${esc(p.id)}"><p class="field-help">Enter your load and reps, or tap a movement, to mark it done — then press Save. Your session stays here all day; come back any time to add the rest. A fresh session arrives tomorrow.</p>${programmeRows(p, true)}${footer("Save today’s progress")}</form>`,
      );
    },
    exercise: (el) => {
      const ex = data.exercises.find((e) => e.id === el.dataset.id);
      const videoMarkup = (empty) => {
        const m = String(ex.videoUrl || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
        if (m)
          return `<iframe class="video-player" style="aspect-ratio:16/9;border:0" src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Exercise demonstration" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        if (ex.video)
          return `<video class="video-player" controls playsinline preload="metadata" src="/api/videos/${encodeURIComponent(ex.id)}"></video>`;
        return empty
          ? '<div class="video-empty">' + icon("dumbbell") + "<h3>Your coach’s technique guide.</h3><p>A video demonstration will appear here when your coach adds one.</p></div>"
          : "";
      };
      if (el.closest("#member-workout")) {
        const row = el.closest(".workout-row");
        const existing = row.querySelector(".inline-technique");
        if (existing) {
          existing.remove();
          return;
        }
        const guide = document.createElement("div");
        guide.className = "inline-technique";
        guide.innerHTML = `${videoMarkup(false)}<ol class="technique-list">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>`;
        row.append(guide);
        return;
      }
      modal(
        ex.name,
        `${ex.equipment} · ${ex.prescription}`,
        `${videoMarkup(true)}<h3 style="margin-top:20px">Coach it well.</h3><ol class="technique-list">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>`,
      );
    },
    meal: () =>
      modal(
        "What’s on the plate?",
        "Log a meal to keep a clear picture of the day.",
        `<form id="member-meal"><label class="field"><span>Meal name</span><input name="name" required maxlength="120"></label><div class="form-grid"><label class="field"><span>Meal</span><select name="type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>${[
          ["calories", "Energy (kcal)"],
          ["protein", "Protein (g)"],
          ["carbs", "Carbs (g)"],
          ["fat", "Fats (g)"],
        ]
          .map(
            ([key, label]) =>
              `<label class="field"><span>${label}</span><input name="${key}" type="number" min="0" max="10000" step="0.1" required></label>`,
          )
          .join("")}</div>${footer("Log food")}</form>`,
      ),
    result: (el) => {
      if (el?.dataset.kind) resultKind = el.dataset.kind;
      return modal(
        "Make progress visible.",
        "A benchmark is a starting point, not a judgement.",
        `<form id="member-result"><label class="field"><span>Measurement</span><select name="kind" id="member-kind">${[...weeklyTests(TODAY).map((t) => t.kind), "Body weight"].map((k) => { const t = testByKind(k); const unit = !t ? "kg" : t.unit === "s" ? "seconds" : t.unit; return `<option value="${esc(k)}" ${k === resultKind ? "selected" : ""}>${esc(k)} · ${unit}</option>`; }).join("")}</select></label><p class="field-help" style="margin:-6px 0 12px">This week's three club tests rotate every Monday — log them to join the board. Whole numbers for reps and seconds. Body weight stays private.</p><div class="form-grid"><label class="field"><span>Result</span><input name="value" type="number" min="0.1" max="10000" step="0.1" required></label><label class="field"><span>Date</span><input name="date" type="date" max="${TODAY}" value="${TODAY}" required></label></div>${footer("Save result")}</form>`,
      );
    },
    password: () =>
      modal(
        "A fresh password.",
        "Update your sign-in details.",
        `<form id="member-password"><label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label><label class="field"><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="512" required></label>${footer("Update password")}</form>`,
      ),
  };
  document.addEventListener("click", async (e) => {
    const navEl = e.target.closest("[data-member-nav]"),
      button = e.target.closest("[data-member-action]");
    try {
      if (e.target.closest(".skip-link")) {
        e.preventDefault();
        $("#main").focus();
        return;
      }
      // Tapping an exercise row (anywhere but its technique button, thumbnail or
      // the load/reps inputs) marks that movement complete — the small "Done"
      // checkbox is easy to miss, so the whole row is the target.
      const wrow = e.target.closest("#member-workout .workout-row");
      if (wrow && !button && !e.target.closest("label,input,button")) {
        const cb = wrow.querySelector('input[name="complete"]');
        if (cb) {
          cb.checked = !cb.checked;
          wrow.classList.toggle("is-done", cb.checked);
        }
        return;
      }
      if (navEl) {
        e.preventDefault();
        await go(navEl.dataset.memberNav);
      } else if (button) {
        button.disabled = true;
        try {
          await actions[button.dataset.memberAction]?.(button);
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      } else if (e.target.classList.contains("modal-backdrop")) close();
    } catch (error) {
      toast(error.message);
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "member-exercise-search")
      $("#member-exercises").innerHTML = exerciseCards(e.target.value);
    if (e.target.matches('#member-workout input[name="complete"]'))
      e.target.closest(".workout-row")?.classList.toggle("is-done", e.target.checked);
    // Entering your load or reps for a movement means you did it — mark the row
    // done automatically so Save never blocks after you've logged your numbers.
    if (e.target.matches('#member-workout input[name^="weight-"], #member-workout input[name^="reps-"]')) {
      const wrow = e.target.closest(".workout-row");
      const cb = wrow?.querySelector('input[name="complete"]');
      if (cb && !cb.checked) { cb.checked = true; wrow.classList.add("is-done"); }
    }
  });
  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!form.id.startsWith("member-")) return;
    e.preventDefault();
    const f = new FormData(form);
    const value = (k) => String(f.get(k) || "").trim();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      if (form.id === "member-workout") {
        const programmeId = form.dataset.programme || plan()?.id;
        const p = plan(programmeId);
        const completed = f.getAll("complete");
        if (!completed.length) {
          // No checkboxes at all = every movement is already logged today. Don't
          // dead-end on an error — just close; the session is done.
          if (!form.querySelector('input[name="complete"]')) {
            close();
            toast("This session's already logged today. Nice work.");
            return;
          }
          throw Error("Tap each exercise you did to mark it done, then press Complete session.");
        }
        // Members may be shown a rotating session (currentSession) whose exercises
        // differ from the programme's flat list — build entries from the ticked
        // ids themselves, and report the session's true size for XP accounting.
        const sess = currentSession(p);
        const total = (sess ? sess.exercises : p?.exercises || []).length;
        await update("workout", {
          programmeId,
          completed,
          total,
          entries: completed.map((id) => ({
            exercise: id,
            weight: Number(f.get("weight-" + id)),
            reps: Number(f.get("reps-" + id)),
          })),
        });
        close();
        const merged = data.logs.find((l) => l.date === TODAY && l.programme === programmeId);
        const doneCount = merged?.completedCount ?? completed.length;
        const totalCount = merged?.exerciseCount ?? (total || 1);
        toast(
          doneCount >= totalCount
            ? "Full session logged. 50 club points earned."
            : `Session saved — ${doneCount} of ${totalCount} exercises done today. ${Math.round(50 * (doneCount / totalCount))} club points so far; log the rest later to top it up.`,
        );
      }
      if (form.id === "member-checkin") {
        await update("checkin", { text: value("text") });
        close();
        toast("Check-in shared with your coach.");
      }
      if (form.id === "member-meal") {
        await update("meal", {
          name: value("name"),
          type: value("type"),
          calories: Number(f.get("calories")),
          protein: Number(f.get("protein")),
          carbs: Number(f.get("carbs")),
          fat: Number(f.get("fat")),
        });
        close();
        toast("Meal logged.");
      }
      if (form.id === "member-result") {
        await update("result", {
          kind: value("kind"),
          date: value("date"),
          value: Number(f.get("value")),
        });
        resultKind = value("kind");
        render();
        close();
        toast("Result saved.");
      }
      if (form.id === "member-privacy") {
        await update("privacy", { optIn: f.has("optIn") });
        toast("Your sharing preference is saved.");
      }
      if (form.id === "member-password") {
        await api("/api/password", {
          method: "POST",
          body: { current: value("current"), password: value("password") },
        });
        close();
        toast("Password updated.");
      }
    } catch (error) {
      let target = form.querySelector(".form-error");
      if (!target) {
        target = document.createElement("p");
        target.className = "form-error";
        target.setAttribute("role", "alert");
        form.append(target);
      }
      target.textContent = error.message;
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      actions["menu-close"]();
    }
    if (e.key === "Tab" && $(".modal")) {
      const focusable = [
          ...document.querySelectorAll(
            ".modal button:not([disabled]),.modal input,.modal select,.modal textarea",
          ),
        ].filter((e) => e.getClientRects().length),
        first = focusable[0],
        last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("popstate", () => go(location.hash.slice(1)));
  setInterval(async () => {
    if (
      document.visibilityState !== "visible" ||
      $(".modal") ||
      document.activeElement?.matches("input,textarea,select")
    )
      return;
    try {
      data = (await api("/api/workspace")).workspace;
      normalizeMember(data);
      if (route === "club") rows = (await api("/api/leaderboard")).rows;
      render();
    } catch {}
  }, 20000);
  go(location.hash.slice(1));
}
