import { describe, it, expect, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { req, wipe, fullWorkspace, memberLogin, setupCoach, BASE } from "./helpers";

beforeEach(wipe);

describe("end-to-end", () => {
  it("runs the full coach + member lifecycle", async () => {
    // Coach sets up the club (with exercise e1, programme p1, clients c1/c2).
    const coach = await setupCoach(fullWorkspace());

    // Invite c1 and accept as a member.
    const member = await memberLogin();

    // Member logs a workout.
    const log = await req(
      "/api/member/actions",
      "POST",
      { key: "e2e-1", action: "workout", completed: ["e1"], entries: [{ exercise: "e1", weight: 80, reps: 5 }] },
      member,
    );
    expect(log.status).toBe(200);

    // Coach sees the member's new log (coaches see everyone's data).
    const coachView = await req("/api/workspace", "GET", undefined, { cookie: coach.cookie });
    expect(coachView.json.workspace.logs.some((l: any) => l.client === "c1")).toBe(true);

    // Consent: c1 opts in; member leaderboard shows only self, coach sees both.
    await req("/api/member/actions", "POST", { key: "e2e-2", action: "privacy", optIn: true }, member);
    const lbMember = await req("/api/leaderboard", "GET", undefined, { cookie: member.cookie });
    expect(lbMember.json.rows.map((r: any) => r.id)).toEqual(["c1"]);
    const lbCoach = await req("/api/leaderboard", "GET", undefined, { cookie: coach.cookie });
    expect(lbCoach.json.rows.map((r: any) => r.id).sort()).toEqual(["c1", "c2"]);

    // Video upload + stream.
    const vid = new Uint8Array(500);
    vid.set([0x66, 0x74, 0x79, 0x70], 4);
    const up = await SELF.fetch(BASE + "/api/videos/e1", {
      method: "POST",
      headers: { "Content-Type": "video/mp4", Cookie: coach.cookie, "X-CSRF-Token": coach.csrf },
      body: vid,
    });
    expect(up.status).toBe(200);
    const stream = await SELF.fetch(BASE + "/api/videos/e1", { headers: { Cookie: member.cookie } });
    expect(stream.status).toBe(200);
    expect((await stream.arrayBuffer()).byteLength).toBe(500);
  });

  it("applies security headers to API and static responses", async () => {
    const health = await SELF.fetch(BASE + "/api/health");
    expect(health.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(health.headers.get("X-Frame-Options")).toBe("DENY");
    expect(health.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(health.headers.get("Content-Security-Policy")).toContain("youtube-nocookie.com");

    const page = await SELF.fetch(BASE + "/");
    expect(page.status).toBe(200);
    expect(page.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(page.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
