// supple Worker entry point. Serves the frozen front-end (public/) and the /api/*
// routes, same-origin. Security model ported 1:1 from server.py.
import { APIError, json } from "./http";
import { Env, publicOrigin } from "./env";
import {
  authStatus,
  authSetup,
  authLogin,
  authLogout,
  changePassword,
  inviteInfo,
  acceptInvite,
} from "./auth";

export type { Env };

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
  const m = req.method;

  if (m === "GET" && path === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ status: "ok" }, 200, {}, origin);
  }
  if (m === "GET" && path === "/api/auth/status") return authStatus(req, env);
  if (m === "POST" && path === "/api/auth/setup") return authSetup(req, env);
  if (m === "POST" && path === "/api/auth/login") return authLogin(req, env);
  if (m === "POST" && path === "/api/auth/logout") return authLogout(req, env);
  if (m === "POST" && path === "/api/auth/accept") return acceptInvite(req, env);
  if (m === "POST" && path === "/api/password") return changePassword(req, env);
  if (m === "GET" && path.startsWith("/api/invitations/")) {
    return inviteInfo(req, env, decodeURIComponent(path.slice("/api/invitations/".length)));
  }

  // Workspace / member / leaderboard / video routes are added in Tasks 5–7.
  throw new APIError("Not found.", 404);
}
