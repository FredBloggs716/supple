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

export const MAX_JSON = 3 * 1024 * 1024;

// Ports server.py read_json(): JSON content-type, size cap, must be an object.
export async function readJson(req: Request): Promise<any> {
  const ct = (req.headers.get("Content-Type") || "").split(";")[0];
  if (ct !== "application/json") throw new APIError("Send this request as JSON.", 415);
  const len = req.headers.get("Content-Length");
  if (len && Number(len) > MAX_JSON) throw new APIError("That upload is too large.", 413);
  let value: any;
  try {
    value = await req.json();
  } catch {
    throw new APIError("Invalid JSON request.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new APIError("Invalid request body.");
  }
  return value;
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
