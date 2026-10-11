import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import {
  createClub,
  coachExists,
  getWorkspace,
  putWorkspace,
  createSession,
  sessionUser,
  deleteSession,
  createInvite,
  inviteClient,
  deleteClientInvites,
  limitLogin,
  clearAccountAttempts,
} from "../src/db";
import { tokenHash } from "../src/crypto";

const DB = () => env.DB;

async function wipe() {
  for (const t of ["users", "sessions", "workspace", "invitations", "videos", "events", "attempts"]) {
    await DB().prepare(`DELETE FROM ${t}`).run();
  }
}

const WS = JSON.stringify({ version: 1, settings: { coach: "C", club: "Club", email: "c@x.com" } });

beforeEach(wipe);

describe("db workspace", () => {
  it("creates a club and reads it back", async () => {
    expect(await coachExists(DB())).toBe(false);
    await createClub(DB(), "u1", "coach@x.com", "hash", "Coach", WS);
    expect(await coachExists(DB())).toBe(true);
    const { w, revision } = await getWorkspace(DB());
    expect(revision).toBe(1);
    expect(w.settings.club).toBe("Club");
  });

  it("a second club creation is rejected", async () => {
    await createClub(DB(), "u1", "coach@x.com", "hash", "Coach", WS);
    await expect(createClub(DB(), "u2", "other@x.com", "hash", "Other", WS)).rejects.toThrow();
  });

  it("putWorkspace is a compare-and-set on revision", async () => {
    await createClub(DB(), "u1", "coach@x.com", "hash", "Coach", WS);
    expect(await putWorkspace(DB(), WS, 1)).toBe(2); // matches current revision
    expect(await putWorkspace(DB(), WS, 1)).toBe(null); // stale -> conflict
  });
});

describe("db sessions", () => {
  it("creates, looks up and deletes a session", async () => {
    await createClub(DB(), "u1", "coach@x.com", "hash", "Coach", WS);
    const { raw, csrf } = await createSession(DB(), "u1");
    const th = await tokenHash(raw);
    const row = await sessionUser(DB(), th);
    expect(row?.id).toBe("u1");
    expect(row?.csrf).toBe(csrf);
    await deleteSession(DB(), th);
    expect(await sessionUser(DB(), th)).toBe(null);
  });
});

describe("db invitations", () => {
  it("invitation is one-use", async () => {
    await createClub(DB(), "u1", "coach@x.com", "hash", "Coach", WS);
    const { raw } = await createInvite(DB(), "c1");
    const th = await tokenHash(raw);
    expect((await inviteClient(DB(), th))?.client).toBe("c1");
    await deleteClientInvites(DB(), "c1");
    expect(await inviteClient(DB(), th)).toBe(null);
  });

  it("a new invite replaces the previous one", async () => {
    await createClub(DB(), "u1", "coach@x.com", "hash", "Coach", WS);
    const first = await createInvite(DB(), "c1");
    const second = await createInvite(DB(), "c1");
    expect(await inviteClient(DB(), await tokenHash(first.raw))).toBe(null);
    expect((await inviteClient(DB(), await tokenHash(second.raw)))?.client).toBe("c1");
  });
});

describe("db login rate limiting", () => {
  it("blocks after 10 account attempts and clears on success", async () => {
    for (let i = 0; i < 10; i++) await limitLogin(DB(), "ip:1.1.1.1", "account:a@x.com");
    await expect(limitLogin(DB(), "ip:1.1.1.1", "account:a@x.com")).rejects.toThrow();
    await clearAccountAttempts(DB(), "account:a@x.com");
    await expect(limitLogin(DB(), "ip:1.1.1.1", "account:a@x.com")).resolves.toBeUndefined();
  });
});
