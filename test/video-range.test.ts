import { describe, it, expect, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { wipe, fullWorkspace, setupCoach, BASE } from "./helpers";

function fakeMp4(size = 1000): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x66, 0x74, 0x79, 0x70], 4);
  for (let i = 12; i < size; i++) b[i] = i % 251;
  return b;
}

async function setupWithVideo() {
  const coach = await setupCoach(fullWorkspace());
  await SELF.fetch(BASE + "/api/videos/e1", {
    method: "POST",
    headers: { "Content-Type": "video/mp4", Cookie: coach.cookie, "X-CSRF-Token": coach.csrf },
    body: fakeMp4(1000),
  });
  return coach;
}

beforeEach(wipe);

describe("video range requests", () => {
  it("serves a suffix range (last N bytes)", async () => {
    const coach = await setupWithVideo();
    const r = await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: coach.cookie, Range: "bytes=-100" } });
    expect(r.status).toBe(206);
    expect(r.headers.get("Content-Range")).toBe("bytes 900-999/1000");
    expect((await r.arrayBuffer()).byteLength).toBe(100);
  });

  it("serves an open-ended range (from offset to end)", async () => {
    const coach = await setupWithVideo();
    const r = await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: coach.cookie, Range: "bytes=500-" } });
    expect(r.status).toBe(206);
    expect(r.headers.get("Content-Range")).toBe("bytes 500-999/1000");
    expect((await r.arrayBuffer()).byteLength).toBe(500);
  });

  it("416s an unsatisfiable or malformed range", async () => {
    const coach = await setupWithVideo();
    expect((await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: coach.cookie, Range: "bytes=5000-6000" } })).status).toBe(416);
    expect((await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: coach.cookie, Range: "bytes=abc" } })).status).toBe(416);
  });

  it("answers a HEAD request with headers and no body", async () => {
    const coach = await setupWithVideo();
    const r = await SELF.fetch(BASE + "/api/videos/e1", { method: "HEAD", headers: { Cookie: coach.cookie } });
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Length")).toBe("1000");
    expect(r.headers.get("Accept-Ranges")).toBe("bytes");
    expect((await r.arrayBuffer()).byteLength).toBe(0);
  });

  it("requires auth to stream a video", async () => {
    await setupWithVideo();
    expect((await SELF.fetch(BASE + "/api/videos/e1")).status).toBe(401);
  });
});
