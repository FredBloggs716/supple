// Password hashing + token hashing. Ports server.py:117-140 to WebCrypto.
// Stored format is identical: `rounds$saltHex$digestHex`, PBKDF2-HMAC-SHA256.
import { APIError } from "./http";
import { text } from "./validate";

const ROUNDS = 600_000;
const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(s: string): Uint8Array {
  const m = s.match(/../g);
  if (!m) return new Uint8Array(0);
  return new Uint8Array(m.map((h) => parseInt(h, 16)));
}

async function pbkdf2(password: string, salt: Uint8Array, rounds: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

// Validates the password (server.py:117-120) and returns the stored hash string.
export async function passwordHash(password: unknown): Promise<string> {
  text(password, "password", 512);
  if ((password as string).length < 12) {
    throw new APIError("Use a password with at least 12 characters.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await pbkdf2(password as string, salt, ROUNDS);
  return `${ROUNDS}$${toHex(salt.buffer)}$${digest}`;
}

export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  try {
    const [rounds, salt, digest] = stored.split("$");
    const actual = await pbkdf2(password, fromHex(salt), parseInt(rounds, 10));
    return timingSafeEqual(actual, digest);
  } catch {
    return false;
  }
}

export async function tokenHash(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(token)));
}

function base64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// URL-safe session/invite token (mirrors secrets.token_urlsafe).
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

// Hex id (mirrors secrets.token_hex).
export function randomHex(bytes = 16): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

// Constant-time string compare (mirrors hmac.compare_digest).
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}
