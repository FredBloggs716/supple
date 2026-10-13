// Field validators + full workspace validation. Ported verbatim from
// server.py:56-237. This is a security boundary: it defines exactly what shape
// of data may be stored, and (with analytics.viewFor) underpins client isolation.
import { APIError } from "./http";
import { today } from "./time";
import { MEASURE_KINDS } from "./tests";

export type Workspace = any;

export const COLLECTIONS = [
  "clients",
  "programmes",
  "exercises",
  "logs",
  "measures",
  "sessions",
  "meals",
  "activity",
] as const;

export function text(value: unknown, label: string, limit = 200, optional = false): string {
  if (typeof value !== "string" || (!optional && !value.trim()) || value.length > limit) {
    throw new APIError(`Please enter a valid ${label}.`);
  }
  return value.trim();
}

export function number(value: unknown, label: string, low = 0, high = 10000): number {
  // typeof true !== "number", so booleans are rejected like server.py.
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) {
    throw new APIError(`Please enter a valid ${label}.`);
  }
  return value;
}

export function date(value: unknown, future = true): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new APIError("Please enter a valid date.");
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new APIError("Please enter a valid date.");
  }
  if (!future && value > today()) throw new APIError("Choose today or an earlier date.");
  return value;
}

export function email(value: unknown): string {
  const v = text(value, "email address", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    throw new APIError("Please enter a valid email address.");
  }
  return v;
}

export function validateWorkspace(w: any): Workspace {
  if (!w || typeof w !== "object" || Array.isArray(w) || w.version !== 1) {
    throw new APIError("The workspace format is invalid.");
  }
  if (
    !w.settings || typeof w.settings !== "object" || Array.isArray(w.settings) ||
    !w.water || typeof w.water !== "object" || Array.isArray(w.water)
  ) {
    throw new APIError("The workspace settings are invalid.");
  }
  for (const k of ["coach", "club"]) text(w.settings[k], k, 80);
  email(w.settings.email);

  const ids: Record<string, Set<string>> = {};
  for (const key of COLLECTIONS) {
    const items = w[key];
    if (!Array.isArray(items) || items.length > 25000) {
      throw new APIError(`The ${key} list is invalid or too large.`);
    }
    ids[key] = new Set();
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new APIError(`Invalid entry in ${key}.`);
      }
      const itemId = text(item.id, "record ID", 100);
      if (!/^[a-zA-Z0-9_-]+$/.test(itemId) || ids[key].has(itemId)) {
        throw new APIError(
          "Record IDs must be unique and use letters, digits, underscores or hyphens.",
        );
      }
      ids[key].add(itemId);
    }
  }

  for (const c of w.clients) {
    text(c.name, "client name", 80);
    email(c.email);
    if (!["warm", "blue", "sage", "lilac", "pink", ""].includes(c.colour)) {
      throw new APIError("Invalid client colour.");
    }
    if (c.programme && !ids["programmes"].has(c.programme)) {
      throw new APIError("The assigned programme does not exist.");
    }
    if (!Array.isArray(c.notes) || !c.targets || typeof c.targets !== "object") {
      throw new APIError("Invalid client notes or nutrition targets.");
    }
    for (const n of c.notes) {
      text(n.text, "coach note", 2000);
      date(n.date);
    }
    if (c.checkin !== null && c.checkin !== undefined) {
      text(c.checkin, "check-in", 2000, true);
    }
    for (const k of ["calories", "protein", "carbs", "fat"]) number(c.targets[k], k, 1, 10000);
  }
  if (new Set(w.clients.map((c: any) => c.email.toLowerCase())).size !== w.clients.length) {
    throw new APIError("Client email addresses must be unique.");
  }

  for (const p of w.programmes) {
    text(p.name, "programme name", 80);
    text(p.description, "programme description", 300);
    number(p.weeks, "programme duration", 1, 52);
    number(p.frequency, "sessions per week", 1, 7);
    if (!["", "dark", "light", "slate", "sage", "stone"].includes(p.colour)) {
      throw new APIError("Invalid programme colour.");
    }
    if (!Array.isArray(p.exercises) || p.exercises.length < 1 || p.exercises.length > 100) {
      throw new APIError("Choose at least one exercise.");
    }
    for (const e of p.exercises) {
      if (!ids["exercises"].has(e.id)) throw new APIError("A programme exercise does not exist.");
      text(e.sets, "exercise prescription", 80);
    }
  }

  for (const e of w.exercises) {
    text(e.name, "exercise name", 80);
    text(e.equipment, "equipment", 60);
    text(e.prescription, "exercise prescription", 40);
    if (e.videoUrl) text(e.videoUrl, "video link", 200);
    if (!Array.isArray(e.cues) || e.cues.length < 1 || e.cues.length > 30) {
      throw new APIError("Add coaching cues for this exercise.");
    }
    for (const cue of e.cues) text(cue, "coaching cue", 2000);
  }

  for (const key of ["logs", "measures", "meals"]) {
    for (const item of w[key]) {
      if (!ids["clients"].has(item.client)) {
        throw new APIError("A record references a missing client.");
      }
      date(item.date);
    }
  }
  for (const m of w.measures) {
    if (!MEASURE_KINDS.has(m.kind)) {
      throw new APIError("Invalid measurement type.");
    }
    number(m.value, "result", 0.1, 10000);
  }
  for (const m of w.meals) {
    text(m.name, "meal name", 120);
    for (const k of ["calories", "protein", "carbs", "fat"]) number(m[k], k);
  }
  for (const s of w.sessions) {
    text(s.name, "session name", 80);
    date(s.date);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(s.time))) {
      throw new APIError("Invalid session time.");
    }
    if (
      !Array.isArray(s.clients) ||
      new Set(s.clients).size < 1 ||
      new Set(s.clients).size > 6 ||
      s.clients.some((cid: string) => !ids["clients"].has(cid))
    ) {
      throw new APIError("Choose 1 to 6 members for a session.");
    }
    number(s.duration, "duration", 10, 240);
  }
  for (const value of Object.values(w.water)) number(value, "water count", 0, 200);
  return w;
}
