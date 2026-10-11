// Request guards: cookie parsing, CSRF/origin checks, session authentication.
// Ports server.py origin() (396-406) and auth() (408-431).
import { APIError } from "./http";
import { Env, publicOrigin } from "./env";
import { sessionUser, UserRow } from "./db";
import { tokenHash, timingSafeEqual } from "./crypto";

export const COOKIE = "stc_session";

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function checkOrigin(req: Request, env: Env): void {
  const expected = publicOrigin(req, env);
  const supplied = req.headers.get("Origin");
  if (supplied && supplied !== expected) {
    throw new APIError("This request came from another website.", 403);
  }
  if (req.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new APIError("Cross-site request refused.", 403);
  }
}

export async function authenticate(
  req: Request,
  env: Env,
  opts: { coach?: boolean; write?: boolean } = {},
): Promise<UserRow> {
  const token = getCookie(req, COOKIE);
  if (!token) throw new APIError("Please sign in.", 401);
  const row = await sessionUser(env.DB, await tokenHash(token));
  if (!row) throw new APIError("Please sign in again.", 401);
  if (opts.coach && row.role !== "coach") {
    throw new APIError("This action is for your coach.", 403);
  }
  if (opts.write) {
    checkOrigin(req, env);
    const supplied = req.headers.get("X-CSRF-Token") || "";
    if (!timingSafeEqual(supplied, row.csrf || "")) {
      throw new APIError("Refresh the page and try again.", 403);
    }
  }
  return row;
}

export function sessionCookie(raw: string, secure: boolean): string {
  return `${COOKIE}=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure ? "; Secure" : ""}`;
}

export function clearCookie(secure: boolean): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}
