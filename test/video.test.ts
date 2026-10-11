import { describe, it, expect, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { req, wipe, fullWorkspace, memberLogin, setupCoach, BASE } from "./helpers";

// Minimal bytes that pass the magic-byte sniff: "ftyp" at offset 4.
function fakeMp4(size = 1000): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
  for (let i = 12; i < size; i++) b[i] = i % 251;
  return b;
}

async function upload(
  eid: string,
  body: Uint8Array,
  auth: { cookie: string; csrf: string },
  contentType = "video/mp4",
) {
  const res = await SELF.fetch(BASE + "/api/videos/" + eid, {
    method: "POST",
    headers: { "Content-Type": contentType, Cookie: auth.cookie, "X-CSRF-Token": auth.csrf },
    body,
  });
  let j: any = null;
  try {
    j = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json: j };
}

beforeEach(wipe);

describe("video upload", () => {
  it("rejects non-coach, bad mime and non-video bytes", async () => {
    const coach = await setupCoach(fullWorkspace());
    const member = await memberLogin();

    expect((await upload("e1", fakeMp4(), member)).status).toBe(403);
    expect((await upload("e1", fakeMp4(), coach, "text/plain")).status).toBe(415);
    expect((await upload("e1", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), coach)).status).toBe(415);
  });

  it("stores a valid video and flips the exercise flag", async () => {
    const coach = await setupCoach(fullWorkspace());
    const r = await upload("e1", fakeMp4(), coach);
    expect(r.status).toBe(200);
    const ex = r.json.workspace.exercises.find((e: any) => e.id === "e1");
    expect(ex.video).toBe(true);
  });

  it("returns 404 for an exercise with no video", async () => {
    const coach = await setupCoach(fullWorkspace());
    const res = await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: coach.cookie } });
    expect(res.status).toBe(404);
  });
});

describe("video streaming", () => {
  it("serves the full file and honours Range requests", async () => {
    const coach = await setupCoach(fullWorkspace());
    await upload("e1", fakeMp4(1000), coach);

    const full = await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: coach.cookie } });
    expect(full.status).toBe(200);
    expect(full.headers.get("Accept-Ranges")).toBe("bytes");
    expect((await full.arrayBuffer()).byteLength).toBe(1000);

    const part = await SELF.fetch(BASE + "/api/videos/e1", {
      headers: { Cookie: coach.cookie, Range: "bytes=0-9" },
    });
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe("bytes 0-9/1000");
    expect((await part.arrayBuffer()).byteLength).toBe(10);
  });
});
