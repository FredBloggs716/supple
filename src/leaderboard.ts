// Consent-filtered club leaderboard. Ports server.py:753-793.
import { json } from "./http";
import { Env, publicOrigin } from "./env";
import { getWorkspace, UserRow } from "./db";
import { analytics } from "./analytics";
import { today } from "./time";

function mondayIso(): string {
  const now = new Date(today() + "T00:00:00Z");
  const offset = ((now.getUTCDay() + 6) % 7) * 86400000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

export async function leaderboard(req: Request, env: Env, user: UserRow): Promise<Response> {
  const origin = publicOrigin(req, env);
  const { w } = await getWorkspace(env.DB);
  analytics(w); // populates streak + adherence
  const monday = mondayIso();
  const now = today();
  const rows: any[] = [];

  for (const c of w.clients) {
    // Members see only opted-in peers (plus always themselves). Coaches see all.
    if (user.role !== "coach" && !c.leaderboardOptIn && c.id !== user.client) continue;
    const row: any = {
      id: c.id,
      name: displayName(c.name),
      sessions: w.logs.filter(
        (l: any) => l.client === c.id && monday <= l.date && l.date <= now,
      ).length,
      streak: c.streak,
      adherence: c.adherence,
    };
    for (const [kind, key] of [
      ["Deadlift", "deadlift"],
      ["2 km row", "row"],
    ] as const) {
      const results = w.measures
        .filter((m: any) => m.client === c.id && m.kind === kind)
        .sort((a: any, b: any) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      row[key] = results.length ? results[results.length - 1].value : null;
    }
    rows.push(row);
  }
  return json({ rows }, 200, {}, origin);
}
