// Adherence/streak analytics + the role-filtered workspace view.
// Ported from server.py:240-260 (analytics) and 310-336 (view).
// viewFor() is a security boundary: it strips every other client's data and all
// coach notes from a member's response.
import { APIError } from "./http";
import { today } from "./time";

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function weekdayMon0(d: Date): number {
  return (d.getUTCDay() + 6) % 7; // Monday=0 … Sunday=6, matching Python date.weekday()
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function mondayOf(d: Date): Date {
  return addDays(d, -weekdayMon0(d));
}
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// Python round() is round-half-to-even; values here are non-negative.
function bankersRound(x: number): number {
  if (Math.abs(x - Math.trunc(x) - 0.5) < 1e-9) {
    const floor = Math.floor(x);
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(x);
}

export function analytics(w: any): any {
  const now = parseDate(today());
  const monday = mondayOf(now);
  for (const c of w.clients) {
    const days: Date[] = w.logs
      .filter((l: any) => l.client === c.id)
      .map((l: any) => parseDate(l.date));
    const p = w.programmes.find((p: any) => p.id === c.programme) || null;
    const completed = days.filter((d) => d >= monday && d <= now).length;
    c.adherence = Math.min(100, bankersRound((completed / (p ? p.frequency : 3)) * 100));
    const weeks = new Set(days.filter((d) => d <= now).map((d) => dateKey(mondayOf(d))));
    let cursor = weeks.has(dateKey(monday)) ? monday : addDays(monday, -7);
    let streak = 0;
    while (weeks.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -7);
    }
    c.streak = streak;
  }
  return w;
}

export function viewFor(user: any, wIn: any): any {
  const w = analytics(structuredClone(wIn));
  if (user.role === "coach") return w;
  const cid = user.client;
  const own = w.clients.find((c: any) => c.id === cid);
  if (!own) throw new APIError("This client account is no longer available.", 403);
  // Club feed: own posts + posts from members who opted into club sharing,
  // annotated with display names (first name + last initial) before clients
  // are stripped from the view.
  const display = (name: string) => {
    const parts = String(name).trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  };
  const optIn = new Map(w.clients.map((c: any) => [c.id, !!c.leaderboardOptIn]));
  const names = new Map(w.clients.map((c: any) => [c.id, display(c.name)]));
  w.feed = (Array.isArray(w.feed) ? w.feed : [])
    .filter((f: any) => f.client === cid || optIn.get(f.client))
    .slice(0, 50)
    .map((f: any) => ({ ...f, name: names.get(f.client) || "A member" }));
  own.notes = [];
  w.clients = [own];
  w.programmes = w.programmes.filter((p: any) => p.id === own.programme);
  for (const k of ["logs", "meals", "measures"]) {
    w[k] = w[k].filter((r: any) => r.client === cid);
  }
  w.sessions = w.sessions
    .filter((s: any) => s.clients.includes(cid))
    .map((s: any) => ({
      ...s,
      clients: [cid],
      attended: (s.attended || []).includes(cid) ? [cid] : [],
    }));
  w.water = Object.fromEntries(
    Object.entries(w.water).filter(([k]) => k.startsWith(cid + "-")),
  );
  w.activity = [];
  w.settings = {
    club: w.settings.club,
    coach: w.settings.coach,
    ...(w.settings.whatsapp ? { whatsapp: w.settings.whatsapp } : {}),
  };
  w.readNotifications = [];
  return w;
}
