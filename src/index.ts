// supple Worker entry point. Serves the frozen front-end (public/) and the /api/*
// routes, same-origin. Security model ported 1:1 from server.py.
import { APIError, json, securityHeaders } from "./http";
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
import { authenticate } from "./guards";
import { getWorkspaceHandler, putWorkspaceHandler } from "./workspace";
import { createInvitation, memberActions } from "./member";
import { leaderboard } from "./leaderboard";
import { uploadVideo, serveVideo } from "./video";

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
        // Serve the frozen front-end, but apply the same security headers the
        // Python server put on static responses (server.py:1013).
        const res = await env.ASSETS.fetch(req);
        const headers = new Headers(res.headers);
        for (const [k, v] of Object.entries(securityHeaders(origin))) headers.set(k, v);
        return new Response(res.body, { status: res.status, headers });
      }
      throw new APIError("Not found.", 404);
    } catch (err) {
      if (err instanceof APIError) {
        return json({ error: err.msg }, err.status, {}, origin);
      }
      console.error("UNCAUGHT", err instanceof Error ? err.stack : String(err));
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

  if (path === "/api/workspace" && m === "GET") {
    return getWorkspaceHandler(req, env, await authenticate(req, env));
  }
  if (path === "/api/workspace" && m === "PUT") {
    return putWorkspaceHandler(req, env, await authenticate(req, env, { write: true }));
  }

  if (path === "/api/invitations" && m === "POST") {
    return createInvitation(req, env, await authenticate(req, env, { write: true }));
  }
  if (path === "/api/member/actions" && m === "POST") {
    return memberActions(req, env, await authenticate(req, env, { write: true }));
  }
  if (path === "/api/leaderboard" && m === "GET") {
    return leaderboard(req, env, await authenticate(req, env));
  }

  if (path.startsWith("/api/videos/")) {
    const eid = decodeURIComponent(path.slice("/api/videos/".length));
    if (m === "POST") {
      return uploadVideo(req, env, await authenticate(req, env, { write: true }), eid);
    }
    if (m === "GET" || m === "HEAD") {
      await authenticate(req, env);
      return serveVideo(req, env, eid, m === "HEAD");
    }
  }

  throw new APIError("Not found.", 404);
}
