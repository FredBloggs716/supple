// Worker environment bindings + origin helpers (kept separate to avoid import cycles).

export interface Env {
  DB: D1Database;
  VIDEOS: R2Bucket;
  ASSETS: Fetcher;
  STC_PUBLIC_ORIGIN: string;
  STC_SETUP_TOKEN: string;
  AI: Ai;
}

// The canonical origin: the configured public origin, else the request's own.
export function publicOrigin(req: Request, env: Env): string {
  if (env.STC_PUBLIC_ORIGIN) return env.STC_PUBLIC_ORIGIN.replace(/\/+$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

// Setup is token-free only on localhost with no public origin (mirrors
// server.py's local_setup). On workers.dev / a custom domain, a setup token
// is required to create the coach account.
export function isLocalSetup(req: Request, env: Env): boolean {
  if (env.STC_PUBLIC_ORIGIN) return false;
  const host = new URL(req.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function cookieSecure(req: Request, env: Env): boolean {
  return publicOrigin(req, env).startsWith("https://");
}
