import { seedData, TODAY, dayKey, offsetDay, mondayOf } from "./data.js";
import { icon } from "./icons.js";
import { api, bootAuth, logout } from "./auth.js";
const session = await bootAuth();
if (session.user.role === "member") {
  const { startMemberApp } = await import("./member.js");
  startMemberApp(session);
} else {
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
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
  let data = session.workspace;
  let revision = session.revision;
  let saving = false;
  const navItems = [
    ["overview", "grid", "Overview"],
    ["clients", "users", "Clients"],
    ["programmes", "book", "Programmes"],
    ["nutrition", "nutrition", "Nutrition"],
    ["library", "video", "Exercise library"],
    ["progress", "chart", "Progress"],
    ["schedule", "calendar", "Schedule"],
    ["leaderboard", "trophy", "Club leaderboard"],
    ["settings", "settings", "Settings"],
  ];
  const ui = {
    route: "overview",
    filter: "All",
    search: "",
    selectedClient: data.clients[0]?.id,
    metric: "Sessions",
    weeks: 8,
    day: TODAY,
    board: "Attendance",
    progress: "Deadlift",
  };
  let modalReturnFocus = null;
  let videoURL = null;
  let toastTimer;
  let dialogSerial = 0;
  const id = () => crypto.randomUUID();
  const client = (cid) => data.clients.find((c) => c.id === cid);
  const programme = (pid) => data.programmes.find((p) => p.id === pid);
  const exercise = (eid) => data.exercises.find((e) => e.id === eid);
  const initials = (name) =>
    String(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("");
  const avatar = (c, big = false) =>
    `<span class="avatar ${c.colour || "blue"} ${big ? "big" : ""}" aria-hidden="true">${esc(initials(c.name))}</span>`;
  const pill = (label, tone = "", dot = false) =>
    `<span class="pill ${tone}">${dot ? '<i class="dot"></i>' : ""}${esc(label)}</span>`;
  const btn = (label, action, ic = "", variant = "", extra = "") =>
    `<button class="btn ${variant}" data-action="${action}" ${extra}>${ic ? icon(ic) : ""}${esc(label)}</button>`;
  const link = (label, action, extra = "") =>
    `<button class="text-link" data-action="${action}" ${extra}>${esc(label)}${icon("arrow")}</button>`;
  const empty = (title, desc, ic = "search") =>
    `<div class="empty-state">${icon(ic)}<h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
  const dateLabel = (date, opts = { day: "numeric", month: "short" }) =>
    new Intl.DateTimeFormat("en-GB", {
      ...opts,
      timeZone: "Europe/London",
    }).format(new Date(date + "T12:00:00"));
  const clientOptions = (selected = ui.selectedClient, list = data.clients) =>
    list
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`,
      )
      .join("");
  const selectClient = () =>
    `<select class="client-select" id="client-select" aria-label="Select client">${clientOptions()}</select>`;
  const totalAttendance = (cid, week = mondayOf(TODAY)) =>
    data.logs.filter(
      (l) =>
        (!cid || l.client === cid) &&
        l.date >= week &&
        l.date <= offsetDay(week, 6),
    ).length;
  const adherence = () =>
    Math.round(
      data.clients.reduce((n, c) => n + c.adherence, 0) /
        Math.max(1, data.clients.length),
    );
  const pending = () => data.clients.filter((c) => c.checkin);
  const weeklyGoal = () =>
    data.clients.reduce(
      (total, c) => total + (programme(c.programme)?.frequency || 3),
      0,
    );
  const winner = () =>
    [...data.clients].sort(
      (a, b) =>
        totalAttendance(b.id) - totalAttendance(a.id) ||
        b.adherence - a.adherence,
    )[0];
  const latestMeasure = (cid, kind) =>
    data.measures
      .filter((m) => m.client === cid && m.kind === kind)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)?.value;
  async function persist() {
    saving = true;
    try {
      const result = await api("/api/workspace", {
        method: "PUT",
        body: { workspace: data, revision },
      });
      data = result.workspace;
      revision = result.revision;
    } catch (error) {
      try {
        const result = await api("/api/workspace");
        data = result.workspace;
        revision = result.revision;
      } catch {}
      throw error;
    } finally {
      saving = false;
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").innerHTML = icon("checkCircle") + esc(message);
    $("#toast").classList.add("show");
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
  }
  function activity(title, text, ic = "checkCircle", tone = "green") {
    data.activity.unshift({
      id: id(),
      title,
      text,
      icon: ic,
      tone,
      date: TODAY,
    });
    data.activity = data.activity.slice(0, 30);
  }
  function heading(
    title,
    subtitle,
    action = "",
    eyebrow = "YOUR COACHING SPACE",
  ) {
    return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="heading-actions">${action}</div></div>`;
  }
  function stat(label, value, unit, ic, trend, detail) {
    return `<div class="stat"><div class="stat-top">${esc(label)}<span class="stat-icon">${icon(ic)}</span></div><div class="stat-number">${esc(value)}<small>${esc(unit)}</small></div><div class="stat-bottom"><span class="trend">${icon("trend")}${esc(trend)}</span><span>${esc(detail)}</span><span class="stat-mini-line" aria-hidden="true">${[8, 12, 10, 16, 13, 19, 22].map((n) => `<i style="height:${n}px"></i>`).join("")}</span></div></div>`;
  }
  function filterTabs(items) {
    return `<div class="filter-tabs" role="group" aria-label="Filter">${items.map((t) => `<button class="tab ${ui.filter === t ? "active" : ""}" data-action="filter" data-value="${t}" aria-pressed="${ui.filter === t}">${esc(t)}</button>`).join("")}</div>`;
  }
  function searchField(placeholder) {
    return `<label class="search-field">${icon("search")}<input id="view-search" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(ui.search)}"></label>`;
  }
  function shell() {
    const routeName =
      navItems.find((n) => n[0] === ui.route)?.[2] || "Overview";
    const nav = (keys) =>
      navItems
        .filter((n) => keys.includes(n[0]))
        .map(
          ([key, ic, name]) =>
            `<button class="nav-link ${ui.route === key ? "active" : ""}" data-nav="${key}" ${ui.route === key ? 'aria-current="page"' : ""}>${icon(ic)}<span>${name}</span>${key === "clients" ? `<span class="nav-count">${data.clients.length}</span>` : ""}</button>`,
        )
        .join("");
    return `<button class="menu-scrim" data-action="menu-close" aria-label="Close navigation"></button><aside class="sidebar" aria-label="Main navigation"><a class="brand" href="#overview" aria-label="Social Training Club home"><img src="assets/logo-mark.png" alt=""><div class="wordmark">SOCIAL<br>TRAINING CLUB<span>STRONGER TOGETHER</span></div></a><button class="workspace-switch" data-action="workspace"><span class="workspace-icon">${icon("users")}</span><span><strong>Coach workspace</strong><small>${esc(data.settings.club)}</small></span>${icon("down")}</button><p class="nav-label">WORKSPACE</p><nav class="nav-list">${nav(["overview", "clients", "programmes", "nutrition", "library", "progress", "schedule"])}</nav><p class="nav-label nav-gap">THE CLUB</p><nav class="nav-list">${nav(["leaderboard"])}</nav><div class="sidebar-bottom"><nav class="nav-list">${nav(["settings"])}<button class="nav-link" data-action="help">${icon("help")}<span>Help & getting started</span></button></nav><div class="club-note">${icon("heart")}<strong>Good people. Better together.</strong>A little support goes a long way.<br>That’s what this club is here for.</div><button class="coach-profile" data-nav="settings">${avatar({ name: data.settings.coach, colour: "warm" })}<span><strong>${esc(data.settings.coach)}</strong><small>Head coach</small></span>${icon("more")}</button></div></aside><div class="shell"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Open navigation">${icon("menu")}</button><div class="breadcrumbs"><span>Workspace</span>${icon("chevron")}<strong>${routeName}</strong></div><div class="top-actions"><button class="search-trigger" data-action="search" aria-label="Search clients, programmes and exercises">${icon("search")}<span>Search anything...</span><kbd>⌘ K</kbd></button><span class="top-divider"></span><button class="icon-btn" data-action="notifications" aria-label="Notifications">${icon("bell")}${data.settings.checkinAlerts && pending().some((c) => !data.readNotifications.includes(c.id)) ? '<i class="notification-dot"></i>' : ""}</button><button class="icon-btn" data-nav="settings" aria-label="Your profile">${avatar({ name: data.settings.coach, colour: "warm" })}</button></div></header><main class="content" id="main" tabindex="-1">${renderPage()}<footer class="page-footer"><span class="footer-brand"><img src="assets/logo-mark.png" alt="">Social Training Club <span>·</span> Built on showing up.</span><span class="local-status"><i class="dot"></i>Shared workspace · Connected</span></footer></main></div>`;
  }
  function render() {
    document.title = `${navItems.find((n) => n[0] === ui.route)?.[2] || "Overview"} · Social Training Club`;
    $("#app").innerHTML = shell();
  }
  function go(route) {
    if (!navItems.some((n) => n[0] === route)) route = "overview";
    closeModal();
    ui.route = route;
    ui.filter = "All";
    ui.search = "";
    if (location.hash !== "#" + route) history.pushState(null, "", "#" + route);
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function routeFromHash() {
    go(location.hash.slice(1) || "overview");
  }
  function renderPage() {
    if (
      !data.clients.length &&
      !["clients", "programmes", "library", "settings"].includes(ui.route)
    ) {
      return (
        heading(
          "Your club starts here.",
          "Add your first client, give them a plan, and invite them to join.",
          btn("Add your first client", "add-client", "plus", "accent"),
        ) +
        `<section class="panel">${empty("A little support. A new starting point.", "Your training, nutrition, progress and calendar will take shape as you add your people.", "users")}</section>`
      );
    }

    return (
      {
        overview: overviewPage,
        clients: clientsPage,
        programmes: programmesPage,
        nutrition: nutritionPage,
        library: libraryPage,
        progress: progressPage,
        schedule: schedulePage,
        leaderboard: leaderboardPage,
        settings: settingsPage,
      }[ui.route] || overviewPage
    )();
  }
  function ring(percent, colour = "#fff", bg = "#ffffff22") {
    const circumference = 2 * Math.PI * 62;
    return `<svg viewBox="0 0 144 144" aria-hidden="true"><circle cx="72" cy="72" r="62" fill="none" stroke="${bg}" stroke-width="5"/><circle cx="72" cy="72" r="62" fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - Math.min(percent, 100) / 100)}"/></svg>`;
  }
  function overviewPage() {
    const w = winner();
    return `${heading("Morning, " + data.settings.coach.split(" ")[0] + ".", "A little structure. A lot of progress. Here’s your club today.", `<button class="btn date-button" data-nav="schedule">${icon("calendar")}${dateLabel(TODAY, { day: "numeric", month: "short", year: "numeric" })}</button>${btn("Create programme", "create-programme", "plus", "accent")}`)}<div class="stats-grid">${stat("Active clients", data.clients.length, "", "users", `${data.clients.filter((c) => c.status === "On track").length} on track`, "in your club")}${stat("Sessions this week", totalAttendance(), "", "calendar", "Keep it going", "sessions logged")}${stat("Programme adherence", adherence(), "%", "chart", "Showing up", "club average")}${stat("Check-ins to review", pending().length, "", "message", pending().length ? "Let’s catch up" : "All caught up", pending().length ? "a little support helps" : "you’re up to date")}</div><div class="hero-grid"><section class="hero"><div><div class="eyebrow">PROGRESS IS A TEAM SPORT</div><h2>Small steps.<br>Stronger people.</h2><p>Your members are putting in the work.<br>Let’s give them the support to keep going.</p><div class="hero-actions">${btn(pending().length ? "Review check-ins" : "View your clients", pending().length ? "checkins" : "go-clients", "arrow", "white")}<span>${pending().length} ${pending().length === 1 ? "member is" : "members are"} waiting to hear from you</span></div></div><div class="hero-ring">${ring(adherence())}<div class="ring-text">${icon("trend")}<strong>${adherence()}<span style="font-size:20px">%</span></strong><small>club consistency</small></div></div></section><section class="spotlight"><div class="spotlight-top">${icon("trophy")}TRAINER OF THE WEEK</div><div class="spotlight-person"><div class="crown-avatar">${totalAttendance(w.id) ? icon("crown", "crown") + avatar(w, true) : icon("trophy")}</div><div><h3>${totalAttendance(w.id) ? esc(w.name) : "This week’s spot is open."}</h3><p>${totalAttendance(w.id) ? "Making showing up a habit." : "Your next session counts."}</p></div></div><div class="spotlight-bottom"><div class="spotlight-stats"><b>${totalAttendance(w.id)}</b> sessions <span>·</span> <b>${w.streak}</b> week streak</div>${link("The leaderboard", "go-leaderboard")}</div></section></div><div class="main-grid">${performancePanel()}<section class="panel"><div class="panel-head"><div><h2>On the schedule</h2><p class="panel-sub">${dateLabel(ui.day, { weekday: "long", day: "numeric", month: "long" })}</p></div>${link("View all", "go-schedule")}</div>${dateStrip()}<div>${sessionRows(false)}</div><div class="panel-footer"><span>${data.sessions.filter((s) => s.date === ui.day).length} sessions planned</span>${link("Add session", "create-session")}</div></section></div><div class="bottom-grid"><section class="panel"><div class="panel-head"><div><h2>Your clients</h2><p class="panel-sub">Good coaching starts with a check-in.</p></div>${link("View all clients", "go-clients")}</div>${clientTable(data.clients.slice(0, 4), true)}<div class="panel-footer"><span>Showing ${Math.min(4, data.clients.length)} of ${data.clients.length} clients</span><span>${pending().length} check-ins need a little attention</span></div></section><section class="panel"><div class="panel-head"><h2>Around the club</h2><span class="pill neutral">Latest updates</span></div><div class="activity-list">${data.activity
      .slice(0, 3)
      .map(
        (a) =>
          `<div class="activity"><span class="activity-symbol ${a.tone}">${icon(a.icon)}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div><time>${a.date === TODAY ? "Today" : dateLabel(a.date)}</time></div>`,
      )
      .join(
        "",
      )}</div><div class="panel-footer"><span>Every bit of progress counts.</span>${icon("heart")}</div></section></div>`;
  }
  function chartSVG(values, labels, previous = null, unit = "") {
    const width = 570,
      height = 172,
      left = 35,
      right = 15,
      top = 18,
      bottom = 27;
    const max = Math.max(...values, ...(previous || []), 1) * 1.13;
    const y = (v) => height - bottom - (v / max) * (height - top - bottom);
    const x = (i) =>
      left + (i * (width - left - right)) / Math.max(1, values.length - 1);
    const points = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(labels.map((l, i) => l + ": " + values[i] + unit).join(", "))}" preserveAspectRatio="none">${[
      0, 1, 2, 3,
    ]
      .map((i) => {
        const n = Math.round((max * i) / 3);
        return `<line x1="${left}" x2="${width - right}" y1="${y(n)}" y2="${y(n)}" stroke="#e8edf4" stroke-dasharray="3 4"/><text x="${left - 9}" y="${y(n) + 3}" text-anchor="end">${n}${esc(unit)}</text>`;
      })
      .join(
        "",
      )}${previous ? `<polyline points="${points(previous)}" stroke="#b8c6e2" stroke-width="2" fill="none" stroke-dasharray="4 5"/>` : ""}<polygon points="${left},${height - bottom} ${points(values)} ${x(values.length - 1)},${height - bottom}" fill="#002c8c" opacity=".035"/><polyline points="${points(values)}" stroke="#002c8c" stroke-width="2.6" stroke-linejoin="round" fill="none"/>${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === values.length - 1 ? 4 : 2.5}" fill="${i === values.length - 1 ? "#fff" : "#002c8c"}" stroke="#002c8c" stroke-width="2"><title>${esc(labels[i])}: ${v}${esc(unit)}</title></circle><text x="${x(i)}" y="${height - 4}" text-anchor="middle">${esc(labels[i])}</text>`).join("")}</svg>`;
  }
  function performancePanel() {
    const weeks = Array.from({ length: ui.weeks }, (_, i) =>
      offsetDay(mondayOf(TODAY), (i - ui.weeks + 1) * 7),
    );
    const counts = weeks.map((w) => totalAttendance(null, w));
    const values =
      ui.metric === "Sessions"
        ? counts
        : counts.map((v) =>
            Math.min(100, Math.round((v / Math.max(1, weeklyGoal())) * 100)),
          );
    return `<section class="panel chart-panel"><div class="panel-head"><div><h2>Progress, together</h2><p class="panel-sub">Small, consistent efforts add up.</p></div><select class="select-small" id="chart-weeks" aria-label="Chart period"><option value="8" ${ui.weeks === 8 ? "selected" : ""}>Last 8 weeks</option><option value="4" ${ui.weeks === 4 ? "selected" : ""}>Last 4 weeks</option></select></div><div class="chart-options"><div class="tabs">${["Sessions", "Attendance"].map((m) => `<button class="tab ${m === ui.metric ? "active" : ""}" data-action="chart-metric" data-value="${m}">${m}</button>`).join("")}</div><div class="chart-key"><span><i class="key-dot"></i>${ui.metric === "Sessions" ? "Completed" : "Attendance"}</span><span><i class="key-dot previous"></i>${ui.metric === "Sessions" ? "Weekly goal" : "100% goal"}</span></div></div><div class="chart-wrap">${chartSVG(
      values,
      weeks.map((w) => dateLabel(w)),
      weeks.map(() => (ui.metric === "Sessions" ? weeklyGoal() : 100)),
      ui.metric === "Sessions" ? "" : "%",
    )}</div><div class="chart-note">${icon("trend")}<span><strong>${totalAttendance()} sessions</strong> logged this week. Every one is a step forward.</span></div></section>`;
  }
  function dateStrip(large = false) {
    const monday = mondayOf(ui.day);
    return `<div class="date-strip ${large ? "schedule-days" : ""}">${Array.from(
      { length: 7 },
      (_, i) => {
        const d = offsetDay(monday, i);
        return `<button class="date-item ${d === ui.day ? "active" : ""} ${data.sessions.some((s) => s.date === d) ? "has-session" : ""}" data-action="select-day" data-date="${d}" aria-label="${dateLabel(d, { weekday: "long", day: "numeric", month: "long" })}" aria-pressed="${d === ui.day}"><span>${dateLabel(d, { weekday: "short" })}</span><b>${dateLabel(d, { day: "numeric" })}</b></button>`;
      },
    ).join("")}</div>`;
  }
  function sessionRows(large) {
    const sessions = data.sessions
      .filter((s) => s.date === ui.day)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (!sessions.length)
      return empty(
        "A little breathing room.",
        "No sessions on this day. Add one when you’re ready.",
        "calendar",
      );
    return sessions
      .map(
        (s, i) =>
          `<div class="session-row"><span class="session-time">${esc(s.time)}</span><i class="session-bar ${i % 2 ? "light" : ""}"></i><div class="session-info"><strong>${esc(s.name)}</strong><small>${esc(s.type)} · ${s.duration} min · ${s.clients.length} ${s.clients.length === 1 ? "member" : "members"}</small></div>${large ? pill(s.status, s.status === "Completed" ? "success" : "neutral") : ""}<button class="${large ? "btn small" : "icon-btn"}" data-action="session-detail" data-id="${s.id}" aria-label="View ${esc(s.name)} at ${esc(s.time)}">${large ? "View session" : icon("chevron")}</button></div>`,
      )
      .join("");
  }
  function clientTable(clients, compact = false) {
    if (!clients.length)
      return empty("No clients found.", "Try another name or filter.", "users");
    return `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Programme</th>${compact ? "" : "<th>Goal</th>"}<th>Adherence</th><th>Status</th><th><span class="muted">View</span></th></tr></thead><tbody>${clients.map((c) => `<tr><td><button class="client-cell client-name" data-action="client" data-id="${c.id}">${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${c.streak} week streak</small></span></button></td><td>${esc(programme(c.programme)?.name || "Not assigned")}</td>${compact ? "" : `<td>${esc(c.goal)}</td>`}<td><div class="table-progress"><div class="progress-track"><i style="width:${Math.min(100, c.adherence)}%"></i></div><span>${c.adherence}%</span></div></td><td>${pill(c.status, c.status === "On track" ? "success" : "warning", true)}</td><td><button class="icon-btn table-action" data-action="client" data-id="${c.id}" aria-label="View ${esc(c.name)}">${icon("chevron")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function filteredClients() {
    return data.clients.filter(
      (c) =>
        (ui.filter === "All" ||
          c.status === ui.filter ||
          (ui.filter === "Check-ins" && c.checkin)) &&
        `${c.name} ${c.email}`.toLowerCase().includes(ui.search.toLowerCase()),
    );
  }
  function clientsPage() {
    return `${heading("People, not numbers.", "Your clients. Their goals. One place to keep them moving.", btn("Add client", "add-client", "plus", "accent"), "YOUR PEOPLE")}<div class="stats-grid">${stat("Your clients", data.clients.length, "", "users", "All welcome", "in the club")}${stat("On track", data.clients.filter((c) => c.status === "On track").length, "", "checkCircle", "Steady progress", "keep supporting them")}${stat("Check-ins", pending().length, "", "message", "Stay connected", "ready to review")}${stat("Club consistency", adherence(), "%", "flame", "One step at a time", "average adherence")}</div><div class="toolbar">${filterTabs(["All", "On track", "Needs attention", "Check-ins"])}${searchField("Search clients...")}</div><section class="panel" id="clients-table">${clientTable(filteredClients())}</section>`;
  }
  function filteredProgrammes() {
    return data.programmes.filter(
      (p) =>
        (ui.filter === "All" || p.goal === ui.filter) &&
        p.name.toLowerCase().includes(ui.search.toLowerCase()),
    );
  }
  function programmeCards() {
    const list = filteredProgrammes();
    return list.length
      ? list
          .map((p, i) => {
            const assigned = data.clients.filter((c) => c.programme === p.id);
            return `<article class="panel programme-card"><div class="programme-cover ${p.colour}"><span class="eyebrow">SOCIAL TRAINING CLUB / PROGRAMMES</span><img class="cover-mark" src="assets/logo-mark${p.colour === "light" ? "" : "-white"}.png" alt=""><h3>${esc(p.name)}</h3><span class="cover-number">${String(i + 1).padStart(2, "0")}</span></div><div class="programme-body">${pill(p.goal)}<p class="programme-description">${esc(p.description)}</p><div class="programme-meta"><span>${icon("calendar")}${p.weeks} weeks</span><span>${icon("dumbbell")}${p.frequency} sessions / week</span></div><div class="programme-bottom"><div class="avatar-stack">${assigned
              .slice(0, 3)
              .map((c) => avatar(c))
              .join(
                "",
              )}${assigned.length ? `<span class="avatar">${assigned.length}</span>` : '<span class="muted" style="font-size:10px">Ready to assign</span>'}</div>${btn("View programme", "programme", "arrow", "small", `data-id="${p.id}"`)}</div></div></article>`;
          })
          .join("")
      : empty(
          "Nothing here just yet.",
          "Create a programme or try another filter.",
          "book",
        );
  }
  function programmesPage() {
    return `${heading("A plan with purpose.", "Thoughtful programmes. Clear direction. Room to progress.", btn("Create programme", "create-programme", "plus", "accent"), "THE TRAINING PLAN")}<div class="toolbar">${filterTabs(["All", "Strength", "Conditioning", "Mobility"])}${searchField("Search programmes...")}</div><div class="cards-grid" id="programme-cards">${programmeCards()}</div>`;
  }
  function exerciseCards() {
    const list = data.exercises.filter(
      (e) =>
        (ui.filter === "All" || e.category === ui.filter) &&
        `${e.name} ${e.equipment}`
          .toLowerCase()
          .includes(ui.search.toLowerCase()),
    );
    return list.length
      ? list
          .map(
            (e, i) =>
              `<article class="panel exercise-card"><div class="exercise-visual"><span class="eyebrow">THE MOVEMENT LIBRARY</span>${icon(e.category === "Mobility" ? "heart" : e.category === "Conditioning" ? "zap" : e.category === "Core" ? "target" : "dumbbell")}<span class="exercise-index">STC / ${String(data.exercises.indexOf(e) + 1).padStart(3, "0")}</span><button class="play-button" data-action="exercise" data-id="${e.id}" aria-label="View ${esc(e.name)}">${icon(e.video ? "play" : "arrow")}</button></div><div class="programme-body"><h3>${esc(e.name)}</h3><div class="programme-meta"><span>${icon("dumbbell")}${esc(e.equipment)}</span><span>${e.video ? "Video available" : "Technique guide"}</span></div><div class="exercise-category">${pill(e.category, "neutral")}${link("View exercise", "exercise", `data-id="${e.id}"`)}</div></div></article>`,
          )
          .join("")
      : empty(
          "No movements found.",
          "Try another search or add an exercise.",
          "dumbbell",
        );
  }
  function libraryPage() {
    return `${heading("Move with confidence.", "Your coaching cues and demonstrations, all in one place.", btn("Add exercise", "add-exercise", "plus", "accent"), "THE MOVEMENT LIBRARY")}<div class="toolbar">${filterTabs(["All", "Upper body", "Lower body", "Core", "Conditioning", "Mobility"])}${searchField("Search exercises...")}</div><div class="cards-grid" id="exercise-cards">${exerciseCards()}</div>`;
  }
  function nutritionPage() {
    const c = client(ui.selectedClient) || data.clients[0];
    const meals = data.meals.filter(
      (m) => m.client === c.id && m.date === TODAY,
    );
    const totals = meals.reduce(
      (a, m) => {
        for (const k of ["calories", "protein", "carbs", "fat"]) a[k] += m[k];
        return a;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    const water = data.water[c.id + "-" + TODAY] || 0;
    return `${heading("Fuel the work.", "Simple habits. Balanced plates. Enough energy for the day.", selectClient(), "EVERYDAY NUTRITION")}<div class="two-col"><div class="stack"><section class="panel"><div class="panel-head"><div><h2>Today’s nutrition</h2><p class="panel-sub">${dateLabel(TODAY, { weekday: "long", day: "numeric", month: "long" })} · ${esc(c.name.split(" ")[0])}</p></div>${pill("Daily targets", "neutral")}</div><div class="macro-grid panel-pad">${[
      ["calories", "Energy", "kcal", "#002c8c"],
      ["protein", "Protein", "g", "#5877b2"],
      ["carbs", "Carbs", "g", "#b1904f"],
      ["fat", "Fats", "g", "#75998b"],
    ]
      .map(
        ([k, n, u, col]) =>
          `<div class="macro"><div class="macro-ring">${ring((totals[k] / c.targets[k]) * 100, col, "#edf0f5")}<strong>${totals[k]}</strong></div><strong>${n}</strong><small>of ${c.targets[k]} ${u}</small></div>`,
      )
      .join(
        "",
      )}</div></section><section class="panel"><div class="panel-head"><h2>On the plate</h2>${btn("Log food", "log-food", "plus", "small")}</div>${meals.length ? meals.map((m) => `<div class="meal-row"><span class="meal-icon">${icon(m.type === "Breakfast" ? "coffee" : "nutrition")}</span><div><strong>${esc(m.name)}</strong><small>${esc(m.type)} · ${m.protein}g protein · ${m.carbs}g carbs · ${m.fat}g fat</small></div><span class="mono">${m.calories} <small class="muted">kcal</small></span></div>`).join("") : empty("A fresh plate.", "Log the first meal of the day.", "nutrition")}</section><section class="panel panel-pad"><div class="panel-head" style="padding:0"><div><h2>A little more water.</h2><p class="panel-sub">${(water * 0.25).toFixed(2)} L logged · 2 L daily goal</p></div>${icon("drop")}</div><div class="water-controls"><div class="water-glasses">${Array.from({ length: 8 }, (_, i) => icon("drop", i < water ? "filled" : "")).join("")}</div>${btn("250 ml", "water", "plus", "small")}</div></section></div><div class="stack nutrition-sidebar"><section class="panel"><div class="nutrition-client">${avatar(c, true)}<div><h3>${esc(c.name)}</h3><p>${esc(c.goal)}</p></div></div><form class="panel-pad" id="targets-form"><h3 style="margin-bottom:20px">Daily targets</h3><div class="form-grid">${[
      ["calories", "Energy (kcal)", 500, 10000],
      ["protein", "Protein (g)", 1, 500],
      ["carbs", "Carbs (g)", 1, 1200],
      ["fat", "Fats (g)", 1, 500],
    ]
      .map(
        ([k, label, min, max]) =>
          `<label class="field"><span>${label}</span><input name="${k}" type="number" min="${min}" max="${max}" value="${c.targets[k]}" required></label>`,
      )
      .join(
        "",
      )}</div><p class="field-help" style="margin-bottom:18px">Set individual targets that support this client’s needs and training.</p><button class="btn primary full" type="submit">Save targets${icon("check")}</button></form></section><div class="tip" style="margin-top:20px">${icon("nutrition")}<div><strong>Consistency over perfection.</strong>One meal doesn’t define a week. Encourage habits your clients can keep coming back to.</div></div></div></div>`;
  }
  function progressPage() {
    const c = client(ui.selectedClient) || data.clients[0];
    const points = data.measures
      .filter((m) => m.client === c.id && m.kind === ui.progress)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8);
    return `${heading("See the work add up.", "Progress comes in more than one number. Keep the whole picture in view.", selectClient(), "PERSONAL PROGRESS")}<div class="metrics-grid section-gap"><div class="metric"><small>Latest deadlift</small><strong>${latestMeasure(c.id, "Deadlift") ?? "—"} <small>kg</small></strong><span>Strength you can measure</span></div><div class="metric"><small>Sessions this week</small><strong>${totalAttendance(c.id)} <small>sessions</small></strong><span>Every session counts</span></div><div class="metric"><small>Training streak</small><strong>${c.streak} <small>weeks</small></strong><span>Building a lasting habit</span></div></div><div class="two-col"><section class="panel large-chart"><div class="panel-head"><div><h2>${esc(c.name.split(" ")[0])}’s progress</h2><p class="panel-sub">Your latest 8 logged results</p></div>${btn("Log result", "log-result", "plus", "small")}</div><div class="chart-options"><div class="tabs">${["Deadlift", "Body weight", "2 km row"].map((m) => `<button class="tab ${ui.progress === m ? "active" : ""}" data-action="progress-metric" data-value="${m}">${m}</button>`).join("")}</div><span class="muted" style="font-size:10px">${ui.progress === "2 km row" ? "seconds" : "kg"}</span></div><div class="chart-wrap">${
      points.length
        ? chartSVG(
            points.map((p) => p.value),
            points.map((p) => dateLabel(p.date)),
          )
        : empty(
            "A starting point awaits.",
            "Log a result to begin tracking.",
            "chart",
          )
    }</div><div class="panel-footer"><span>${ui.progress === "Body weight" ? "A single measure, not the whole picture." : "Keep the conditions consistent between tests."}</span>${pill("Personal progress", "neutral")}</div></section><section class="panel"><div class="panel-head"><h2>Recent results</h2>${icon("chart")}</div>${
      [...data.measures]
        .filter((m) => m.client === c.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(
          (m) =>
            `<div class="meal-row"><span class="meal-icon">${icon(m.kind === "Body weight" ? "user" : "dumbbell")}</span><div><strong>${esc(m.kind)}</strong><small>${dateLabel(m.date)}</small></div><span class="mono">${m.value} <small>${m.kind === "2 km row" ? "sec" : "kg"}</small></span></div>`,
        )
        .join("") ||
      empty("No results yet.", "Start with a comfortable benchmark.", "target")
    }</section></div>`;
  }
  function leaderboardPage() {
    const w = winner();
    const list = [...data.clients]
      .filter(
        (c) =>
          ui.board === "Attendance" || latestMeasure(c.id, ui.board) != null,
      )
      .sort((a, b) =>
        ui.board === "Attendance"
          ? totalAttendance(b.id) - totalAttendance(a.id) ||
            b.adherence - a.adherence
          : ui.board === "2 km row"
            ? latestMeasure(a.id, ui.board) - latestMeasure(b.id, ui.board)
            : latestMeasure(b.id, ui.board) - latestMeasure(a.id, ui.board),
      );
    const count = totalAttendance();
    return `${heading("A little friendly competition.", "Celebrate the effort. Share the wins. Bring each other along.", btn("Log a result", "log-result", "plus", "accent"), "STRONGER TOGETHER")}<div class="leader-hero"><div><div class="eyebrow">THE SOCIAL TRAINING CLUB</div><h2>Different starting points.<br>One team.</h2><p>There’s a place on the board for showing up, too.</p></div>${icon("trophy")}</div><div class="two-col"><section class="panel"><div class="panel-head"><div><h2>The club leaderboard</h2><p class="panel-sub">${ui.board === "Attendance" ? "This week · " + dateLabel(mondayOf(TODAY)) + " – " + dateLabel(offsetDay(mondayOf(TODAY), 6)) : "Latest recorded result for each member"}</p></div>${pill(ui.board === "Attendance" ? "Weekly reset" : "Benchmarks", "neutral")}</div><div class="chart-options" style="padding-bottom:18px"><div class="tabs">${["Attendance", "Deadlift", "2 km row"].map((t) => `<button class="tab ${ui.board === t ? "active" : ""}" data-action="board" data-value="${t}">${t}</button>`).join("")}</div></div><div class="table-wrap"><table class="leader-table"><thead><tr><th>Rank</th><th>Club member</th><th>${ui.board === "Attendance" ? "Sessions" : ui.board === "Deadlift" ? "Load" : "Time"}</th><th>Club points</th></tr></thead><tbody>${list.map((c, i) => `<tr><td><span class="rank ${i < 3 ? "top" : ""}">${String(i + 1).padStart(2, "0")}</span></td><td><button class="client-cell client-name" data-action="client" data-id="${c.id}">${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${c.streak} week streak</small></span></button></td><td class="mono">${ui.board === "Attendance" ? totalAttendance(c.id) : ui.board === "2 km row" ? Math.floor(latestMeasure(c.id, ui.board) / 60) + ":" + String(Math.round(latestMeasure(c.id, ui.board) % 60)).padStart(2, "0") : latestMeasure(c.id, ui.board) + " kg"}</td><td>${pill(totalAttendance(c.id) * 50 + " XP", i === 0 ? "success" : "neutral")}</td></tr>`).join("")}</tbody></table></div></section><div class="stack"><section class="panel award-card">${icon("trophy")}<div class="eyebrow" style="color:#92724a;margin-bottom:24px">TRAINER OF THE WEEK</div>${totalAttendance(w.id) ? avatar(w, true) : ""}<h3>${totalAttendance(w.id) ? esc(w.name) : "Your next session counts."}</h3><p>${totalAttendance(w.id)} sessions this week.<br>Keep showing up together.</p><div style="margin-top:17px">${totalAttendance(w.id) ? pill("Showing up champion", "success") : pill("A fresh week", "neutral")}</div><div class="award-rule">Awarded to the member with the most logged sessions this week. Adherence breaks a tie.</div></section><section class="panel challenge">${pill("CLUB CHALLENGE", "neutral")}<h3>${weeklyGoal()} sessions. One club.</h3><p>A shared goal for the week. Every completed session moves us forward.</p><div class="challenge-meta"><strong>${count} / ${weeklyGoal()} sessions</strong><span class="muted">${Math.min(100, Math.round((count / Math.max(1, weeklyGoal())) * 100))}%</span></div><div class="progress-track"><i style="width:${Math.min(100, (count / Math.max(1, weeklyGoal())) * 100)}%"></i></div><p style="margin:14px 0 0;font-size:10px">50 XP per session · Attendance points reset each week.</p></section></div></div>`;
  }
  function schedulePage() {
    return `${heading("Make time for progress.", "Your week, with a little more structure.", btn("Add session", "create-session", "plus", "accent"), "THE CLUB CALENDAR")}<section class="panel"><div class="panel-head"><div><h2>${dateLabel(ui.day, { month: "long", year: "numeric" })}</h2><p class="panel-sub">Times shown in Europe/London</p></div><div class="heading-actions"><button class="icon-btn" data-action="week-prev" aria-label="Previous week">${icon("left")}</button>${btn("Today", "today", "", "small")}<button class="icon-btn" data-action="week-next" aria-label="Next week">${icon("chevron")}</button></div></div>${dateStrip(true)}<div class="panel-head"><h2>${dateLabel(ui.day, { weekday: "long", day: "numeric", month: "long" })}</h2>${pill(data.sessions.filter((s) => s.date === ui.day).length + " sessions", "neutral")}</div><div class="schedule-list">${sessionRows(true)}</div></section>`;
  }
  function settingsPage() {
    return `${heading("Your corner of the club.", "A few details to make this workspace yours.", "", "WORKSPACE SETTINGS")}<div class="two-col"><section class="panel"><div class="panel-head"><h2>Coach & club details</h2>${icon("user")}</div><form class="panel-pad" id="settings-form"><div class="form-grid"><label class="field"><span>Your name</span><input name="coach" value="${esc(data.settings.coach)}" required maxlength="80"></label><label class="field"><span>Email</span><input name="email" type="email" value="${esc(data.settings.email)}" required></label><label class="field span-2"><span>Club name</span><input name="club" value="${esc(data.settings.club)}" required maxlength="80"></label></div><div class="settings-row"><div><strong>Check-in notifications</strong><p>Show unread check-ins in the notification centre.</p></div><label class="switch"><input type="checkbox" name="checkinAlerts" ${data.settings.checkinAlerts ? "checked" : ""} aria-label="Check-in notifications"><span></span></label></div><div class="settings-row"><div><strong>Club milestone updates</strong><p>Include recent achievements in your notifications.</p></div><label class="switch"><input type="checkbox" name="milestoneAlerts" ${data.settings.milestoneAlerts ? "checked" : ""} aria-label="Club milestone updates"><span></span></label></div><div class="modal-footer"><button class="btn primary" type="submit">Save changes${icon("check")}</button></div></form></section><div class="stack"><section class="panel panel-pad"><span class="activity-symbol">${icon("shield")}</span><h3 style="margin:17px 0 10px">Your working space.</h3><p style="font-size:12px;line-height:1.8" class="muted">Your coach workspace and client accounts share one database. Programme changes and logged sessions are available across devices.</p><p style="font-size:11px;line-height:1.8;margin:13px 0 20px" class="muted">Export your structured records here. Your server’s data folder contains the database and uploaded videos; back up both together.</p>${btn("Export workspace", "export", "download", "full")}<div class="account-actions">${btn("Change password", "change-password", "shield", "full")}${btn("Sign out", "logout", "arrow", "full")}</div></section><div class="tip">${icon("heart")}<div><strong>Built around your coaching.</strong>Start with a client, give them a programme, and keep showing up for each other.</div></div></div></div>`;
  }
  function openModal(title, subtitle, body, wide = false) {
    if (!$("#modal-root").children.length)
      modalReturnFocus = document.activeElement;
    dialogSerial++;
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
      videoURL = null;
    }
    $("#modal-root").innerHTML =
      `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="modal-head"><div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon("x")}</button></header><div class="modal-body">${body}</div></section></div>`;
    document.body.classList.add("body-lock");
    {
      const el =
        $(".modal input:not([type=checkbox]),.modal select,.modal textarea") ||
        $(".modal button");
      el?.focus({ preventScroll: true });
    }
  }
  function closeModal() {
    const wasOpen = $("#modal-root").children.length;
    $("#modal-root").innerHTML = "";
    document.body.classList.remove("body-lock");
    dialogSerial++;
    if (videoURL) {
      URL.revokeObjectURL(videoURL);
      videoURL = null;
    }
    if (wasOpen && modalReturnFocus?.isConnected)
      modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
  }
  const formFooter = (label = "Save", ic = "check") =>
    `<p class="form-error" role="alert"></p><div class="modal-footer">${btn("Cancel", "close-modal", "", "")}<button class="btn primary" type="submit">${esc(label)}${icon(ic)}</button></div>`;
  function trainingHistory(cid) {
    const logs = data.logs
      .filter((l) => l.client === cid)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    return `<h3 style="margin:24px 0 14px">Recent training</h3>${logs.length ? logs.map((l) => `<div class="client-note"><strong>${esc(programme(l.programme)?.name || l.type)}</strong><time>${dateLabel(l.date)}</time>${(l.entries || []).map((e) => `<p>${esc(exercise(e.exercise)?.name)} · ${esc(e.weight)} kg × ${esc(e.reps)} reps</p>`).join("")}</div>`).join("") : '<p class="muted">Completed workouts will appear here.</p>'}`;
  }
  function clientModal(cid) {
    const c = client(cid);
    if (!c) return;
    openModal(
      c.name,
      "A clear picture, so you can coach the person.",
      `<div class="profile-head">${avatar(c, true)}<div><h3>${esc(c.name)}</h3><p>${esc(c.email)}</p><div style="margin-top:9px">${pill(c.status, c.status === "On track" ? "success" : "warning", true)}</div></div></div><div class="profile-stats"><div class="profile-stat"><small>This week</small><strong>${totalAttendance(c.id)} sessions</strong></div><div class="profile-stat"><small>Adherence</small><strong>${c.adherence}%</strong></div><div class="profile-stat"><small>Streak</small><strong>${c.streak} weeks</strong></div></div><div class="info-row"><span>Training goal</span><strong>${esc(c.goal)}</strong></div><div class="info-row"><span>Member since</span><strong>${dateLabel(c.joined, { day: "numeric", month: "long", year: "numeric" })}</strong></div><form id="assign-form" data-client="${c.id}" style="margin-top:18px"><label class="field"><span>Assigned programme</span><select name="programme"><option value="">No programme</option>${data.programmes.map((p) => `<option value="${p.id}" ${c.programme === p.id ? "selected" : ""}>${esc(p.name)} · ${p.weeks} weeks</option>`).join("")}</select></label><button class="btn primary small" type="submit">Save assignment${icon("check")}</button></form><div class="heading-actions" style="margin:20px 0">${btn("Create sign-in link", "invite-client", "mail", "primary small", `data-id="${c.id}"`)}${btn("View progress", "client-progress", "chart", "small", `data-id="${c.id}"`)}${btn("Nutrition", "client-nutrition", "nutrition", "small", `data-id="${c.id}"`)}</div>${c.checkin ? `<div class="checkin-item"><div class="checkin-top"><strong>Latest check-in</strong>${pill("Needs review", "warning")}</div><blockquote>${esc(c.checkin)}</blockquote>${btn("Mark as reviewed", "review-checkin", "check", "small", `data-id="${c.id}"`)}</div>` : ""}${trainingHistory(c.id)}<h3 style="margin:24px 0 14px">Coach notes</h3>${c.notes.length ? c.notes.map((n) => `<div class="client-note">${esc(n.text)}<time>${dateLabel(n.date)}</time></div>`).join("") : '<p class="muted" style="font-size:11px;margin-bottom:16px">The little details that make your coaching personal.</p>'}<form id="note-form" data-client="${c.id}"><label class="field"><span>Add a private note</span><textarea name="note" maxlength="2000" placeholder="What would you like to remember for next time?" required></textarea></label><button class="btn small" type="submit">Save note${icon("plus")}</button></form>`,
    );
  }
  function addClientModal() {
    openModal(
      "A new face in the club.",
      "Add a client and give them a place to start.",
      `<form id="client-form"><div class="form-grid"><label class="field"><span>Full name</span><input name="name" placeholder="e.g. Jamie Taylor" required maxlength="80"></label><label class="field"><span>Email address</span><input name="email" type="email" placeholder="jamie@example.com" required maxlength="150"></label><label class="field"><span>Training goal</span><select name="goal"><option>Build strength</option><option>Improve fitness</option><option>Move with confidence</option><option>Build consistency</option></select></label><label class="field"><span>Starting programme</span><select name="programme"><option value="">Assign later</option>${data.programmes.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label></div><p class="field-help">After adding your client, open their profile to create a private sign-in link.</p>${formFooter("Add client", "users")}</form>`,
    );
  }
  function createProgrammeModal() {
    openModal(
      "Good training starts with a plan.",
      "Build a repeatable session, then assign it to your people.",
      `<form id="programme-form"><div class="form-grid"><label class="field span-2"><span>Programme name</span><input name="name" required maxlength="80" placeholder="e.g. Your next strong chapter"></label><label class="field"><span>Training focus</span><select name="goal"><option>Strength</option><option>Conditioning</option><option>Mobility</option></select></label><label class="field"><span>Duration (weeks)</span><input name="weeks" type="number" min="1" max="52" value="8" required></label><label class="field"><span>Sessions per week</span><input name="frequency" type="number" min="1" max="7" value="3" required></label><label class="field"><span>Assign to a client</span><select name="client"><option value="">Assign later</option>${clientOptions("")}</select></label><label class="field span-2"><span>A short description</span><textarea name="description" required maxlength="300" placeholder="What are we working towards?"></textarea></label></div><p class="section-label">Choose your exercises</p><p class="field-help" style="margin-bottom:13px">Each weekly session uses this exercise list and the prescriptions shown.</p><div class="exercise-picker">${data.exercises.map((e) => `<label class="exercise-option"><input type="checkbox" name="exercises" value="${e.id}"><span>${esc(e.name)}<small class="muted" style="display:block;margin-top:4px">${esc(e.prescription)}</small></span></label>`).join("")}</div>${formFooter("Create programme", "plus")}</form>`,
      true,
    );
  }
  function programmeModal(pid) {
    const p = programme(pid);
    if (!p) return;
    const assigned = data.clients.filter((c) => c.programme === p.id);
    openModal(
      p.name,
      `${p.weeks} weeks · ${p.frequency} sessions per week · ${p.goal}`,
      `<p style="font-size:12px;line-height:1.8;margin-bottom:20px">${esc(p.description)}</p><div class="section-label">The session</div>${p.exercises
        .map((item, i) => {
          const e = exercise(item.id);
          return `<div class="workout-row"><span class="workout-index">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(e?.name || "Exercise")}</strong><small>${esc(e?.equipment || "")}</small></div><span>${esc(item.sets)}</span></div>`;
        })
        .join(
          "",
        )}<form id="programme-assign-form" data-programme="${p.id}" style="margin-top:24px"><label class="field"><span>Assign this programme</span><select name="client" required><option value="">Choose a client</option>${clientOptions("")}</select></label><button class="btn primary small" type="submit">Assign programme${icon("users")}</button></form><h3 style="margin:25px 0 12px">Training on this programme</h3>${assigned.length ? assigned.map((c) => `<div class="info-row" style="align-items:center"><button class="client-cell client-name" data-action="client" data-id="${c.id}">${avatar(c)}<strong>${esc(c.name)}</strong></button>${btn("Log session", "workout", "check", "small", `data-client="${c.id}" data-id="${p.id}"`)}</div>`).join("") : '<p class="muted" style="font-size:11px">Assign a client to start logging sessions.</p>'}`,
    );
  }
  function workoutModal(pid, cid) {
    const p = programme(pid),
      c = client(cid);
    openModal(
      "A session well spent.",
      `${c.name} · ${p.name}`,
      `<form id="workout-form" data-programme="${pid}" data-client="${cid}"><p class="field-help" style="margin-bottom:15px">Tick each exercise when the prescribed work is complete. A completed session adds 50 club points.</p>${p.exercises.map((e, i) => `<div class="workout-row"><span class="workout-index">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(exercise(e.id)?.name)}</strong><small>${esc(e.sets)}</small></div><label><span>Done</span><input type="checkbox" name="complete" value="${e.id}" required aria-label="${esc(exercise(e.id)?.name)} complete"></label></div>`).join("")}${formFooter("Complete session", "checkCircle")}</form>`,
    );
  }
  function checkinsModal() {
    const list = pending();
    if (!list.length) {
      openModal(
        "All caught up.",
        "A little attention makes a big difference.",
        empty(
          "Everyone’s been heard.",
          "Your next check-ins will appear here.",
          "checkCircle",
        ),
      );
      return;
    }
    openModal(
      "A little support goes a long way.",
      `${list.length} check-ins ready for your attention.`,
      list
        .map(
          (c) =>
            `<div class="checkin-item"><div class="checkin-top">${avatar(c)}<div><strong>${esc(c.name)}</strong><small>${esc(programme(c.programme)?.name || "Getting started")}</small></div>${pill("New", "warning")}</div><blockquote>${esc(c.checkin)}</blockquote><div class="checkin-actions">${btn("Open profile", "client", "", "small", `data-id="${c.id}"`)}${btn("Mark as reviewed", "review-checkin", "check", "primary small", `data-id="${c.id}"`)}</div></div>`,
        )
        .join(""),
    );
  }
  function foodModal() {
    const c = client(ui.selectedClient);
    openModal(
      "What’s on the plate?",
      `Add a meal for ${c.name.split(" ")[0]}.`,
      `<form id="food-form"><div class="form-grid"><label class="field span-2"><span>Meal or food name</span><input name="name" placeholder="e.g. Salmon, potatoes & vegetables" required maxlength="120"></label><label class="field"><span>Meal</span><select name="type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label><label class="field"><span>Energy (kcal)</span><input name="calories" type="number" min="1" max="10000" required></label>${[
        ["protein", "Protein (g)"],
        ["carbs", "Carbs (g)"],
        ["fat", "Fats (g)"],
      ]
        .map(
          ([k, n]) =>
            `<label class="field"><span>${n}</span><input name="${k}" type="number" min="0" max="1000" step="0.1" required></label>`,
        )
        .join("")}</div>${formFooter("Log food", "nutrition")}</form>`,
    );
  }
  function resultModal() {
    openModal(
      "Make progress visible.",
      "Record a benchmark. Keep the conditions consistent each time.",
      `<form id="result-form"><label class="field"><span>Club member</span><select name="client">${clientOptions()}</select></label><div class="form-grid"><label class="field"><span>Measurement</span><select name="kind" id="result-kind">${["Deadlift", "Body weight", "2 km row"].map((k) => `<option ${k === (ui.route === "leaderboard" && ui.board !== "Attendance" ? ui.board : ui.progress) ? "selected" : ""}>${k}</option>`).join("")}</select></label><label class="field"><span id="result-unit">Result</span><input name="value" type="number" min="0.1" max="10000" step="0.1" required placeholder="Enter result"></label><label class="field span-2"><span>Date</span><input name="date" type="date" max="${TODAY}" value="${TODAY}" required></label></div><p class="field-help">Deadlift and body weight are measured in kg. Enter the total time in seconds for the 2 km row. Benchmarks appear on the club board; body weight stays in personal progress.</p>${formFooter("Save result", "chart")}</form>`,
    );
    updateResultUnit();
  }
  function updateResultUnit() {
    const el = $("#result-kind");
    if (el) {
      $("#result-unit").textContent =
        el.value === "2 km row" ? "Time (seconds)" : "Result (kg)";
      const input = $("#result-form input[name=value]");
      input.step = el.value === "2 km row" ? "1" : "0.1";
      input.min = el.value === "2 km row" ? "1" : "0.1";
    }
  }
  function createSessionModal() {
    openModal(
      "Make a little time.",
      "Put the next session in the diary.",
      `<form id="session-form"><div class="form-grid"><label class="field span-2"><span>Session name</span><input name="name" placeholder="e.g. Morning strength club" required maxlength="80"></label><label class="field"><span>Date</span><input name="date" type="date" value="${ui.day}" required></label><label class="field"><span>Start time</span><input name="time" type="time" value="09:00" required></label><label class="field"><span>Duration (minutes)</span><input name="duration" type="number" value="45" min="10" max="240" required></label><label class="field"><span>Session type</span><select name="type"><option>Small group</option><option>1-to-1</option></select></label></div><p class="section-label">Who’s training?</p><div class="exercise-picker">${data.clients.map((c) => `<label class="exercise-option"><input type="checkbox" name="clients" value="${c.id}">${esc(c.name)}</label>`).join("")}</div><p class="field-help">Small group sessions have up to 6 members. Times use Europe/London.</p>${formFooter("Add session", "calendar")}</form>`,
    );
  }
  function sessionModal(sid) {
    const s = data.sessions.find((s) => s.id === sid);
    openModal(
      s.name,
      `${dateLabel(s.date, { weekday: "long", day: "numeric", month: "long" })} · ${s.time} · ${s.duration} minutes`,
      `${pill(s.status, s.status === "Completed" ? "success" : "neutral")}<div class="info-row" style="margin-top:20px"><span>Coach</span><strong>${esc(s.coach)}</strong></div><div class="info-row"><span>Session</span><strong>${esc(s.type)}</strong></div><h3 style="margin:23px 0 12px">On the list</h3>${s.clients
        .map((cid) => {
          const c = client(cid);
          return `<div class="info-row" style="align-items:center"><span class="client-cell">${avatar(c)}<strong>${esc(c.name)}</strong></span>${s.status === "Completed" ? pill(s.attended?.includes(cid) ? "Attended" : "Absent", s.attended?.includes(cid) ? "success" : "neutral") : `<label style="display:flex;align-items:center;gap:8px;font-size:11px"><input type="checkbox" name="attendee" value="${cid}" checked aria-label="${esc(c.name)} attended">Attended</label>`}</div>`;
        })
        .join(
          "",
        )}${s.status === "Completed" ? '<div class="inline-note">Attendance has been saved and club points updated.</div>' : `<div class="inline-note">Untick anyone who didn’t attend. Completing this session saves each attendee’s progress and adds 50 club points.</div><div class="modal-footer">${btn("Complete session", "complete-scheduled", "check", "primary", `data-id="${s.id}" ${s.date > TODAY ? "disabled" : ""}`)}</div>${s.date > TODAY ? '<p class="field-help">Attendance can be completed on or after the session date.</p>' : ""}`}`,
    );
  }
  function addExerciseModal() {
    openModal(
      "One more movement.",
      "Add your coaching cues, then upload a video demonstration.",
      `<form id="exercise-form"><label class="field"><span>Exercise name</span><input name="name" required maxlength="80" placeholder="e.g. Dumbbell shoulder press"></label><div class="form-grid"><label class="field"><span>Category</span><select name="category">${["Upper body", "Lower body", "Core", "Full body", "Conditioning", "Mobility"].map((c) => `<option>${c}</option>`).join("")}</select></label><label class="field"><span>Equipment</span><input name="equipment" required placeholder="e.g. Dumbbell" maxlength="60"></label><label class="field span-2"><span>Suggested sets & reps</span><input name="prescription" placeholder="e.g. 3 × 10" required maxlength="40"></label><label class="field span-2"><span>Coaching cues (one per line)</span><textarea name="cues" required maxlength="2000" placeholder="Set your feet...&#10;Move with control..."></textarea></label></div>${formFooter("Add exercise", "plus")}</form>`,
    );
  }
  async function storedVideo(eid) {
    return "/api/videos/" + encodeURIComponent(eid);
  }
  async function storeVideo(eid, file) {
    const result = await api("/api/videos/" + encodeURIComponent(eid), {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    });
    data = result.workspace;
    revision = result.revision;
  }
  async function exerciseModal(eid) {
    const e = exercise(eid);
    if (!e) return;
    openModal(
      e.name,
      `${e.category} · ${e.equipment} · ${e.prescription}`,
      `<div id="exercise-video"><div class="video-empty">${icon("video")}<h3>Your demonstration belongs here.</h3><p>Add your own video so clients can see exactly how you coach this movement.</p><label class="btn small" for="video-upload">${icon("upload")}Upload a video</label></div></div><div style="margin:16px 0 25px"><input class="file-control" id="video-upload" type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" data-exercise="${e.id}" aria-label="Upload exercise video"><p class="field-help" style="margin-top:8px">MP4, WebM, Ogg or MOV · Up to 50 MB · Stored in your club’s private library.</p></div><h3>Coach it well.</h3><ol class="technique-list">${e.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>`,
    );
    const serial = dialogSerial;
    if (e.video) {
      try {
        const file = await storedVideo(eid);
        if (file && serial === dialogSerial) {
          videoURL = file;
          $("#exercise-video").innerHTML =
            `<video class="video-player" controls playsinline preload="metadata" src="${videoURL}"></video>`;
        }
      } catch {
        toast("Your video could not be loaded. You can upload it again.");
      }
    }
  }
  function searchModal() {
    openModal(
      "Find your next step.",
      "Search your clients, programmes and exercise library.",
      `<div class="search-modal-input">${icon("search")}<input id="global-search" placeholder="Who or what are you looking for?" aria-label="Search workspace" autocomplete="off"></div><div class="search-results" id="search-results">${searchResults("")}</div>`,
    );
  }
  function searchResults(q) {
    const query = q.trim().toLowerCase();
    const all = [
      ...data.clients.map((c) => ({
        name: c.name,
        sub: "Client · " + c.goal,
        action: "client",
        id: c.id,
        avatar: avatar(c),
      })),
      ...data.programmes.map((p) => ({
        name: p.name,
        sub: "Programme · " + p.goal,
        action: "programme",
        id: p.id,
        avatar: `<span class="activity-symbol">${icon("book")}</span>`,
      })),
      ...data.exercises.map((e) => ({
        name: e.name,
        sub: "Exercise · " + e.equipment,
        action: "exercise",
        id: e.id,
        avatar: `<span class="activity-symbol">${icon("dumbbell")}</span>`,
      })),
    ]
      .filter((r) => `${r.name} ${r.sub}`.toLowerCase().includes(query))
      .slice(0, 9);
    return all.length
      ? all
          .map(
            (r) =>
              `<button class="search-result" data-action="${r.action}" data-id="${r.id}">${r.avatar}<span><strong>${esc(r.name)}</strong><small>${esc(r.sub)}</small></span>${icon("chevron")}</button>`,
          )
          .join("")
      : empty("No matches yet.", "Try a name, a movement or a programme.");
  }
  async function notificationsModal() {
    const checkins = data.settings.checkinAlerts ? pending() : [];
    const milestones = data.settings.milestoneAlerts
      ? data.activity.slice(0, 3)
      : [];
    openModal(
      "A few things for you.",
      "Small updates from around the club.",
      `${checkins.map((c) => `<button class="notification-row" data-action="client" data-id="${c.id}">${avatar(c)}<span><strong>${esc(c.name)} checked in</strong><p>${esc(c.checkin)}</p><small>Ready for your review</small></span></button>`).join("")}${milestones.map((a) => `<div class="notification-row"><span class="activity-symbol ${a.tone}">${icon(a.icon)}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p><small>${dateLabel(a.date)}</small></div></div>`).join("")}${!checkins.length && !milestones.length ? empty("All quiet for now.", "Your club updates will appear here.", "bell") : ""}`,
    );
    data.readNotifications = [
      ...new Set([...data.readNotifications, ...checkins.map((c) => c.id)]),
    ];
    await persist();
    $(".notification-dot")?.remove();
  }
  function helpModal() {
    openModal(
      "A good place to start.",
      "Your club, with a little more structure.",
      `<div class="stack">${[
        [
          "users",
          "1. Add your people",
          "Create client records, set a goal, and keep your coaching notes together.",
        ],
        [
          "book",
          "2. Give them a plan",
          "Create an exercise session, assign a programme, and log completed training.",
        ],
        [
          "nutrition",
          "3. Support the whole week",
          "Set daily nutrition targets, track meals and water, and review check-ins.",
        ],
        [
          "trophy",
          "4. Celebrate showing up",
          "Log results and attendance. Each completed session earns 50 club points.",
        ],
      ]
        .map(
          ([ic, title, text]) =>
            `<div class="activity" style="padding:0;border:0"><span class="activity-symbol">${icon(ic)}</span><div><h3 style="font-size:14px;margin-bottom:6px">${title}</h3><p style="font-size:12px;line-height:1.8">${text}</p></div></div>`,
        )
        .join(
          "",
        )}</div><div class="inline-note">Invite each client from their profile. They can sign in, see their programme, and share training logs and check-ins with you.</div><div class="modal-footer">${btn("Meet your clients", "go-clients", "arrow", "primary")}</div>`,
    );
  }
  function redraw() {
    const scroll = window.scrollY;
    render();
    window.scrollTo(0, scroll);
  }
  const actions = {
    logout,
    "invite-client": async (el) => {
      const result = await api("/api/invitations", {
        method: "POST",
        body: { client: el.dataset.id },
      });
      const url = new URL(location.pathname, location.origin);
      url.searchParams.set("invite", result.token);
      openModal(
        "A place in the club.",
        "Share this private link directly with your client. It expires in 72 hours.",
        `<label class="field"><span>Private sign-in link</span><input id="invite-link" readonly value="${esc(url.href)}"></label><p class="field-help">This link lets the client set a password. Creating a new link replaces any older unused link. For an existing account, it resets their password.</p><div class="modal-footer">${btn("Copy link", "copy-invite", "mail", "primary")}</div>`,
      );
    },
    "copy-invite": async () => {
      const input = $("#invite-link");
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        toast("Private invitation link copied.");
      } catch {
        toast("Select the link above and copy it to share.");
      }
    },
    "change-password": () =>
      openModal(
        "A fresh password.",
        "Update your sign-in details.",
        `<form id="password-form"><label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label><label class="field"><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="512" required></label>${formFooter("Update password")}</form>`,
      ),

    menu: () => {
      $(".sidebar").classList.add("open");
      $(".menu-scrim").classList.add("open");
      $(".mobile-menu").setAttribute("aria-expanded", "true");
    },
    "menu-close": () => {
      $(".sidebar").classList.remove("open");
      $(".menu-scrim").classList.remove("open");
      $(".mobile-menu").setAttribute("aria-expanded", "false");
    },
    "close-modal": closeModal,
    workspace: () => go("settings"),
    help: helpModal,
    search: searchModal,
    notifications: notificationsModal,
    "go-clients": () => go("clients"),
    "go-schedule": () => go("schedule"),
    "go-leaderboard": () => go("leaderboard"),
    "add-client": addClientModal,
    "create-programme": createProgrammeModal,
    checkins: checkinsModal,
    client: (el) => clientModal(el.dataset.id),
    programme: (el) => programmeModal(el.dataset.id),
    exercise: (el) => exerciseModal(el.dataset.id),
    workout: (el) => workoutModal(el.dataset.id, el.dataset.client),
    "log-food": foodModal,
    "log-result": resultModal,
    "create-session": createSessionModal,
    "session-detail": (el) => sessionModal(el.dataset.id),
    "add-exercise": addExerciseModal,
    "client-progress": (el) => {
      ui.selectedClient = el.dataset.id;
      go("progress");
    },
    "client-nutrition": (el) => {
      ui.selectedClient = el.dataset.id;
      go("nutrition");
    },
    filter: (el) => {
      ui.filter = el.dataset.value;
      redraw();
    },
    "chart-metric": (el) => {
      ui.metric = el.dataset.value;
      redraw();
    },
    "progress-metric": (el) => {
      ui.progress = el.dataset.value;
      redraw();
    },
    board: (el) => {
      ui.board = el.dataset.value;
      redraw();
    },
    "select-day": (el) => {
      ui.day = el.dataset.date;
      redraw();
    },
    "week-prev": () => {
      ui.day = offsetDay(ui.day, -7);
      redraw();
    },
    "week-next": () => {
      ui.day = offsetDay(ui.day, 7);
      redraw();
    },
    today: () => {
      ui.day = TODAY;
      redraw();
    },
    "review-checkin": async (el) => {
      const c = client(el.dataset.id);
      c.checkin = null;
      c.status = "On track";
      activity(
        `${c.name.split(" ")[0]}’s check-in reviewed`,
        "A little support to keep the week moving.",
        "message",
      );
      await persist();
      redraw();
      checkinsModal();
      toast("Check-in reviewed. A little support goes a long way.");
    },
    water: async () => {
      const key = ui.selectedClient + "-" + TODAY;
      data.water[key] = (data.water[key] || 0) + 1;
      await persist();
      redraw();
      toast("250 ml logged. Keep it flowing.");
    },
    "complete-scheduled": async (el) => {
      const s = data.sessions.find((s) => s.id === el.dataset.id);
      if (!s || s.status === "Completed" || s.date > TODAY) return;
      const attendees = [
        ...document.querySelectorAll("input[name=attendee]:checked"),
      ].map((c) => c.value);
      s.status = "Completed";
      s.attended = attendees;
      for (const cid of attendees)
        data.logs.push({
          id: id(),
          client: cid,
          date: s.date,
          type: s.name,
          session: s.id,
        });
      activity(
        `${s.name} completed`,
        `${attendees.length} members showed up. Progress, together.`,
      );
      await persist();
      redraw();
      sessionModal(s.id);
      toast(`Attendance saved. ${attendees.length * 50} club points earned.`);
    },
    export: () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `social-training-club-${TODAY}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Workspace exported. Keep your backup somewhere safe.");
    },
  };
  document.addEventListener("click", async (e) => {
    if (e.target.closest(".skip-link")) {
      e.preventDefault();
      $("#main").focus();
      $("#main").scrollIntoView();
      return;
    }
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      go(nav.dataset.nav);
      return;
    }
    const trigger = e.target.closest("[data-action]");
    if (trigger) {
      if (trigger.disabled) return;
      trigger.disabled = true;
      try {
        await actions[trigger.dataset.action]?.(trigger);
      } catch (err) {
        toast(
          err.message || "That change could not be saved. Please try again.",
        );
      } finally {
        if (trigger.isConnected) trigger.disabled = false;
      }
      return;
    }
    if (e.target.classList.contains("modal-backdrop")) closeModal();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "global-search")
      $("#search-results").innerHTML = searchResults(e.target.value);
    if (e.target.id === "view-search") {
      ui.search = e.target.value;
      if (ui.route === "clients")
        $("#clients-table").innerHTML = clientTable(filteredClients());
      if (ui.route === "programmes")
        $("#programme-cards").innerHTML = programmeCards();
      if (ui.route === "library")
        $("#exercise-cards").innerHTML = exerciseCards();
    }
  });
  document.addEventListener("change", async (e) => {
    try {
      if (e.target.id === "chart-weeks") {
        ui.weeks = Number(e.target.value);
        redraw();
      }
      if (e.target.id === "client-select") {
        ui.selectedClient = e.target.value;
        redraw();
      }
      if (e.target.id === "result-kind") updateResultUnit();
      if (e.target.id === "video-upload") {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("video/"))
          throw Error("Choose a video file, such as MP4 or WebM.");
        if (file.size > 50 * 1024 * 1024)
          throw Error("Choose a video smaller than 50 MB.");
        const eid = e.target.dataset.exercise;
        const serial = dialogSerial;
        await storeVideo(eid, file);
        exercise(eid).video = true;
        await persist();
        redraw();
        if (serial === dialogSerial) await exerciseModal(eid);
        toast("Demonstration saved to your exercise library.");
      }
    } catch (err) {
      toast(err.message);
    }
  });
  function formError(form, message) {
    let el = form.querySelector(".form-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "form-error";
      el.setAttribute("role", "alert");
      form.append(el);
    }
    el.textContent = message;
  }
  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    e.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    const f = new FormData(form);
    const val = (n) => String(f.get(n) || "").trim();
    const num = (n) => Number(f.get(n));
    try {
      if (form.id === "password-form") {
        await api("/api/password", {
          method: "POST",
          body: { current: val("current"), password: val("password") },
        });
        closeModal();
        toast("Password updated.");
      } else if (form.id === "client-form") {
        if (!val("name")) throw Error("Please enter the client’s name.");
        if (
          data.clients.some(
            (c) => c.email.toLowerCase() === val("email").toLowerCase(),
          )
        )
          throw Error("A client with that email is already in your club.");
        const c = {
          id: id(),
          name: val("name"),
          email: val("email"),
          goal: val("goal"),
          programme: val("programme"),
          colour: ["warm", "blue", "sage", "lilac"][data.clients.length % 4],
          adherence: 0,
          streak: 0,
          status: "On track",
          checkin: null,
          notes: [],
          targets: { calories: 2200, protein: 140, carbs: 260, fat: 70 },
          joined: TODAY,
        };
        data.clients.push(c);
        activity(
          `${c.name.split(" ")[0]} joined the club`,
          "A new starting point. A little support makes the difference.",
          "users",
        );
        await persist();
        go("clients");
        toast(`${c.name} has a place in the club.`);
      } else if (form.id === "programme-form") {
        const selected = f.getAll("exercises");
        if (!val("name") || !val("description"))
          throw Error("Give your programme a name and a short description.");
        if (!selected.length)
          throw Error("Choose at least one exercise for this programme.");
        const p = {
          id: id(),
          name: val("name"),
          description: val("description"),
          goal: val("goal"),
          weeks: num("weeks"),
          frequency: num("frequency"),
          colour: "",
          exercises: selected.map((eid) => ({
            id: eid,
            sets: exercise(eid).prescription,
          })),
        };
        data.programmes.push(p);
        if (val("client")) client(val("client")).programme = p.id;
        activity("A new programme is ready", p.name, "book", "");
        await persist();
        go("programmes");
        toast("Programme created. A clear next step.");
      } else if (form.id === "assign-form") {
        const c = client(form.dataset.client);
        c.programme = val("programme");
        await persist();
        redraw();
        clientModal(c.id);
        toast("Programme assignment saved.");
      } else if (form.id === "programme-assign-form") {
        const c = client(val("client"));
        if (!c) throw Error("Choose a client first.");
        c.programme = form.dataset.programme;
        await persist();
        redraw();
        programmeModal(c.programme);
        toast(`${c.name.split(" ")[0]} has a new plan.`);
      } else if (form.id === "note-form") {
        const c = client(form.dataset.client);
        if (!val("note")) throw Error("Write a note before saving.");
        c.notes.unshift({ text: val("note"), date: TODAY });
        await persist();
        clientModal(c.id);
        toast("Coach note saved.");
      } else if (form.id === "workout-form") {
        const p = programme(form.dataset.programme);
        if (f.getAll("complete").length !== p.exercises.length)
          throw Error(
            "Mark each exercise complete before logging the session.",
          );
        const c = client(form.dataset.client);
        data.logs.push({
          id: id(),
          client: c.id,
          date: TODAY,
          type: "Programme session",
          programme: p.id,
        });
        activity(
          `${c.name.split(" ")[0]} completed a session`,
          p.name + " · Another step forward.",
        );
        await persist();
        redraw();
        closeModal();
        toast("Session complete. 50 club points earned.");
      } else if (form.id === "targets-form") {
        const c = client(ui.selectedClient);
        c.targets = {
          calories: num("calories"),
          protein: num("protein"),
          carbs: num("carbs"),
          fat: num("fat"),
        };
        await persist();
        redraw();
        toast("Daily nutrition targets updated.");
      } else if (form.id === "food-form") {
        if (!val("name")) throw Error("Please enter a meal name.");
        data.meals.push({
          id: id(),
          client: ui.selectedClient,
          date: TODAY,
          name: val("name"),
          type: val("type"),
          calories: num("calories"),
          protein: num("protein"),
          carbs: num("carbs"),
          fat: num("fat"),
        });
        await persist();
        redraw();
        closeModal();
        toast("Meal logged. A little more of the picture.");
      } else if (form.id === "result-form") {
        if (val("date") > TODAY)
          throw Error("Choose today or an earlier date.");
        data.measures.push({
          id: id(),
          client: val("client"),
          date: val("date"),
          kind: val("kind"),
          value: num("value"),
        });
        if (val("kind") !== "Body weight")
          activity(
            `${client(val("client")).name.split(" ")[0]} logged a result`,
            `${val("kind")} · ${num("value")} ${val("kind") === "2 km row" ? "seconds" : "kg"}`,
            "trophy",
            "gold",
          );
        await persist();
        ui.selectedClient = val("client");
        ui.progress = val("kind");
        redraw();
        closeModal();
        toast("Result saved. Progress worth noticing.");
      } else if (form.id === "session-form") {
        const members = f.getAll("clients");
        if (!val("name")) throw Error("Give the session a name.");
        if (!members.length)
          throw Error("Add at least one member to the session.");
        if (val("type") === "1-to-1" && members.length !== 1)
          throw Error("Choose one member for a 1-to-1 session.");
        if (val("type") === "Small group" && members.length > 6)
          throw Error("Small group sessions have a maximum of 6 members.");
        data.sessions.push({
          id: id(),
          name: val("name"),
          date: val("date"),
          time: val("time"),
          duration: num("duration"),
          type: val("type"),
          clients: members,
          coach: data.settings.coach.split(" ")[0],
          status: "Scheduled",
        });
        await persist();
        ui.day = val("date");
        go("schedule");
        toast("Session added to the diary.");
      } else if (form.id === "exercise-form") {
        if (
          !val("name") ||
          !val("equipment") ||
          !val("cues") ||
          !val("prescription")
        )
          throw Error("Complete each field to add the exercise.");
        const ex = {
          id: id(),
          name: val("name"),
          category: val("category"),
          equipment: val("equipment"),
          prescription: val("prescription"),
          cues: val("cues")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          video: false,
        };
        data.exercises.push(ex);
        await persist();
        go("library");
        await exerciseModal(ex.id);
        toast("Exercise added. Upload your demonstration when you’re ready.");
      } else if (form.id === "settings-form") {
        if (!val("coach") || !val("club"))
          throw Error("Add a coach and club name.");
        data.settings = {
          ...data.settings,
          coach: val("coach"),
          email: val("email"),
          club: val("club"),
          checkinAlerts: f.has("checkinAlerts"),
          milestoneAlerts: f.has("milestoneAlerts"),
        };
        await persist();
        redraw();
        toast("Your workspace details are saved.");
      }
    } catch (err) {
      formError(form, err.message || "Something went wrong. Please try again.");
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchModal();
    }
    if (e.key === "Escape") {
      closeModal();
      actions["menu-close"]();
    }
    if (e.key === "Tab" && $(".modal")) {
      const nodes = [
        ...document.querySelectorAll(
          '.modal button:not([disabled]),.modal input:not([disabled]),.modal select,.modal textarea,.modal [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("popstate", routeFromHash);
  routeFromHash();
  setInterval(async () => {
    if (
      saving ||
      document.visibilityState !== "visible" ||
      $(".modal") ||
      document.activeElement?.matches("input,textarea,select")
    )
      return;
    try {
      const result = await api("/api/workspace");
      if (saving) return;
      if (result.revision !== revision) {
        data = result.workspace;
        revision = result.revision;
        redraw();
      }
    } catch {}
  }, 20000);
}
