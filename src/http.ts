// Shared HTTP helpers. Mirrors server.py's json()/security_headers()/APIError.

export class APIError extends Error {
  constructor(public msg: string, public status = 400) {
    super(msg);
  }
}

export function securityHeaders(origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
  if (origin.startsWith("https://")) h["Strict-Transport-Security"] = "max-age=31536000";
  return h;
}

export function json(
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
  origin = "",
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...securityHeaders(origin),
      ...extra,
    },
  });
}
