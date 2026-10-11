// supple Worker entry point. Serves the frozen front-end (public/) and the /api/* routes,
// same-origin. Security model ported 1:1 from server.py — see docs/superpowers/specs.

import { APIError, json } from "./http";

export interface Env {
  DB: D1Database;
  VIDEOS: R2Bucket;
  ASSETS: Fetcher;
  STC_PUBLIC_ORIGIN: string;
  STC_SETUP_TOKEN: string;
}

// The origin used for security headers (HSTS only on https).
export function publicOrigin(req: Request, env: Env): string {
  if (env.STC_PUBLIC_ORIGIN) return env.STC_PUBLIC_ORIGIN.replace(/\/+$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const origin = publicOrigin(req, env);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await api(req, env, url);
      }
      if (req.method === "GET" || req.method === "HEAD") {
        return env.ASSETS.fetch(req);
      }
      throw new APIError("Not found.", 404);
    } catch (err) {
      if (err instanceof APIError) {
        return json({ error: err.msg }, err.status, {}, origin);
      }
      return json(
        { error: "The server could not complete this request. Please try again." },
        500,
        {},
        origin,
      );
    }
  },
};

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const origin = publicOrigin(req, env);
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ status: "ok" }, 200, {}, origin);
  }

  // Remaining /api routes are added in Tasks 4–7.
  throw new APIError("Not found.", 404);
}
