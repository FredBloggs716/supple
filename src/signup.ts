// Self-serve member sign-up (public, £10/month advertised; payment arranged
// offline by the coach). Requires a completed PAR-Q and an explicit
// train-at-own-risk consent. New members join the club's workspace as clients
// and get a member account + session immediately.
import { APIError, json, readJson } from "./http";
import { Env, publicOrigin, cookieSecure } from "./env";
import {
  getWorkspace,
  putWorkspace,
  userByEmail,
  insertUser,
  createSession,
  limitLogin,
} from "./db";
import { passwordHash } from "./crypto";
import { text, email, validateWorkspace } from "./validate";
import { checkOrigin, sessionCookie } from "./guards";
import { randomHex } from "./crypto";
import { today } from "./time";

const COLOURS = ["warm", "blue", "sage", "lilac", "pink"];

export async function signup(req: Request, env: Env): Promise<Response> {
  const origin = publicOrigin(req, env);
  checkOrigin(req, env);
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  await limitLogin(env.DB, "ip:" + ip, "signup:" + ip);

  const body = await readJson(req);
  const name = text(body.name, "name", 80);
  const address = email(body.email);
  const hashed = await passwordHash(body.password);

  // PAR-Q: exactly 7 honest yes/no answers.
  const parq = body.parq;
  if (!Array.isArray(parq) || parq.length !== 7 || parq.some((a) => typeof a !== "boolean")) {
    throw new APIError("Please answer every PAR-Q question.");
  }
  if (body.consent !== true) {
    throw new APIError("Please read and accept the declaration to join.");
  }

  const { w, revision } = await getWorkspace(env.DB);
  if (
    (await userByEmail(env.DB, address)) ||
    w.clients.some((c: any) => c.email.toLowerCase() === address)
  ) {
    throw new APIError(
      "That email already has an account. Sign in instead, or ask your coach for a new sign-in link.",
      409,
    );
  }

  const cid = randomHex(12);
  const flagged = parq.some(Boolean);
  w.clients.push({
    id: cid,
    name,
    email: address,
    colour: COLOURS[w.clients.length % COLOURS.length],
    programme: "",
    goal: "Improve fitness",
    joined: today(),
    status: "On track",
    notes: [],
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
    parq: { answers: parq, flagged, date: today() },
    consent: { acceptedAt: today(), version: 1 },
    source: "self",
  });
  w.activity.unshift({
    id: randomHex(16),
    title: name.split(/\s+/)[0] + " joined the club",
    text: flagged
      ? "Self sign-up · PAR-Q flagged — review before programming."
      : "Self sign-up · PAR-Q clear. Arrange their membership payment.",
    date: today(),
    icon: "users",
    tone: flagged ? "" : "green",
  });
  w.activity = w.activity.slice(0, 30);
  validateWorkspace(w);

  const newRevision = await putWorkspace(env.DB, JSON.stringify(w), revision);
  if (newRevision === null) {
    throw new APIError("The club is busy right now — please try again.", 409);
  }

  const uid = randomHex(16);
  await insertUser(env.DB, {
    id: uid,
    email: address,
    password: hashed,
    role: "member",
    client: cid,
    name,
  });
  const { raw } = await createSession(env.DB, uid);
  return json(
    { ok: true, flagged },
    201,
    { "Set-Cookie": sessionCookie(raw, cookieSecure(req, env)) },
    origin,
  );
}
